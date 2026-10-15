import type { ScheduleActivity } from "./commissioning";

const DAY = 86_400_000;
export const dayNumber = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.NaN;
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) &&
    new Date(value).toISOString().slice(0, 10) === date
    ? value / DAY
    : Number.NaN;
};
export const calendarDays = (start: string, finish: string) =>
  dayNumber(finish) - dayNumber(start);
function dateAt(day: number): string {
  const value = new Date(day * DAY).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Schedule exceeds the supported date range.");
  return value;
}
const weekday = (day: number) => (((day + 4) % 7) + 7) % 7;
export const isWorkday = (date: string) =>
  Number.isFinite(dayNumber(date)) &&
  ![0, 6].includes(weekday(dayNumber(date)));
export function nextWorkday(date: string) {
  let d = dayNumber(date);
  if (!Number.isFinite(d)) throw new Error("Invalid schedule date.");
  while ([0, 6].includes(weekday(d))) d++;
  return dateAt(d);
}
export function addWorkdays(date: string, days: number): string {
  let d = dayNumber(date);
  if (
    !Number.isFinite(d) ||
    !isWorkday(date) ||
    !Number.isInteger(days) ||
    days < 0 ||
    days > 4000
  )
    throw new Error("Invalid working-day offset or non-working start date.");
  d += Math.floor(days / 5) * 7;
  let remainder = days % 5;
  while (remainder > 0) {
    d++;
    if (![0, 6].includes(weekday(d))) remainder--;
  }
  return dateAt(d);
}
export function workingDuration(start: string, finish: string) {
  const a = dayNumber(start),
    b = dayNumber(finish);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a || b - a > 36500)
    throw new Error("Invalid activity date range.");
  const span = b - a + 1;
  let total = Math.floor(span / 7) * 5;
  for (let d = a + Math.floor(span / 7) * 7; d <= b; d++)
    if (![0, 6].includes(weekday(d))) total++;
  return Math.max(1, total);
}

/** Atomic forecast calculation. Completed and legacy date-only records are never moved automatically. */
export function recalculateSchedule(input: ScheduleActivity[]) {
  const errors: string[] = [],
    changes: string[] = [];
  const rows = new Map(input.map((row) => [row.activityId, { ...row }]));
  if (rows.size !== input.length)
    errors.push("Duplicate Activity ID in programme.");
  const pending = new Map<string, number>(),
    successors = new Map<string, string[]>();
  for (const row of rows.values()) {
    for (const field of [
      "start",
      "finish",
      "actualFinish",
      "baselineStart",
      "baselineFinish",
      "notBefore",
    ] as const) {
      if (row[field] !== undefined && !Number.isFinite(dayNumber(row[field])))
        errors.push(`${row.activityId}: invalid ${field} date.`);
    }
    if (
      row.durationDays !== undefined &&
      (!Number.isInteger(row.durationDays) ||
        row.durationDays < 1 ||
        row.durationDays > 3650)
    )
      errors.push(
        `${row.activityId}: duration must be between 1 and 3650 working days.`,
      );
    if (row.start && row.actualFinish && row.actualFinish < row.start)
      errors.push(
        `${row.activityId}: actual finish precedes its recorded start.`,
      );
    if (
      row.baselineStart &&
      row.baselineFinish &&
      row.baselineFinish < row.baselineStart
    )
      errors.push(
        `${row.activityId}: baseline finish precedes baseline start.`,
      );
    const links = row.predecessors ?? [];
    if (new Set(links.map((p) => p.activityId)).size !== links.length)
      errors.push(`${row.activityId}: duplicate predecessor.`);
    pending.set(row.activityId, links.length);
    for (const link of links) {
      if (
        !Number.isInteger(link.lagDays) ||
        link.lagDays < 0 ||
        link.lagDays > 365
      )
        errors.push(
          `${row.activityId}: predecessor lag must be between 0 and 365 working days.`,
        );
      if (!rows.has(link.activityId))
        errors.push(
          `${row.activityId}: predecessor ${link.activityId} not found.`,
        );
      if (row.activityId === link.activityId)
        errors.push(`${row.activityId}: an activity cannot depend on itself.`);
      const list = successors.get(link.activityId) ?? [];
      list.push(row.activityId);
      successors.set(link.activityId, list);
    }
  }
  if (errors.length) return { schedule: input, errors, changes: [] };
  const queue = [...pending].filter(([, n]) => n === 0).map(([id]) => id);
  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++],
      row = rows.get(id)!;
    if (row.durationDays !== undefined || (row.predecessors?.length ?? 0) > 0) {
      try {
        const requested = row.notBefore ?? row.start;
        if (!requested)
          throw new Error(
            "Set an earliest start before adding dependencies or duration.",
          );
        const duration =
          row.durationDays ??
          (row.start && (row.finish ?? row.actualFinish)
            ? workingDuration(row.start, (row.finish ?? row.actualFinish)!)
            : undefined);
        if (!duration || duration > 3650)
          throw new Error("Set a duration between 1 and 3650 working days.");
        let start = row.actualFinish ? requested : nextWorkday(requested);
        for (const link of row.predecessors ?? []) {
          const predecessor = rows.get(link.activityId)!;
          const finish = predecessor.actualFinish ?? predecessor.finish;
          if (!finish)
            throw new Error(
              `Predecessor ${link.activityId} needs a finish date.`,
            );
          // FS0 is the next working day after finish, even for weekend actuals.
          const earliest = addWorkdays(
            nextWorkday(dateAt(dayNumber(finish) + 1)),
            link.lagDays,
          );
          if (earliest > start) start = earliest;
        }
        if (row.actualFinish) {
          if (!row.start)
            throw new Error(
              "A completed managed activity needs its recorded start date.",
            );
          if (start > row.start)
            throw new Error(
              "Dependencies or earliest start conflict with the completed activity's recorded dates. Review the actual dates or dependency; completed activities cannot be moved automatically.",
            );
          // Actual dates are historical facts. Preserve even a weekend start/finish.
          if (!row.baselineStart || !row.baselineFinish)
            changes.push(
              `${id}: recorded initial baseline from completed activity dates`,
            );
          Object.assign(row, {
            baselineStart: row.baselineStart ?? row.start,
            baselineFinish:
              row.baselineFinish ?? row.finish ?? row.actualFinish,
          });
        } else {
          const finish = addWorkdays(start, duration - 1);
          if (row.start !== start || row.finish !== finish)
            changes.push(
              `${id}: recalculated ${row.start ?? "undated"}–${row.finish ?? "undated"} → ${start}–${finish}`,
            );
          else if (
            row.durationDays !== duration ||
            row.notBefore !== requested ||
            !row.baselineStart ||
            !row.baselineFinish
          )
            changes.push(
              `${id}: established working-day plan and initial baseline`,
            );
          Object.assign(row, {
            start,
            finish,
            durationDays: duration,
            notBefore: requested,
            baselineStart: row.baselineStart ?? start,
            baselineFinish: row.baselineFinish ?? finish,
          });
        }
        if (
          row.baselineStart &&
          row.baselineFinish &&
          row.baselineFinish < row.baselineStart
        )
          throw new Error(
            "Baseline finish precedes baseline start. Supply a coherent initial baseline.",
          );
      } catch (error) {
        errors.push(
          `${id}: ${error instanceof Error ? error.message : "Invalid schedule."}`,
        );
      }
    } else if (row.start && row.finish && row.finish < row.start) {
      errors.push(`${id}: finish precedes start.`);
    }
    for (const successor of successors.get(id) ?? []) {
      const remaining = pending.get(successor)! - 1;
      pending.set(successor, remaining);
      if (remaining === 0) queue.push(successor);
    }
  }
  if (cursor !== rows.size)
    errors.push("Dependency cycle detected. Remove a link before saving.");
  return errors.length
    ? { schedule: input, errors, changes: [] }
    : {
        schedule: input.map((row) => rows.get(row.activityId)!),
        errors,
        changes,
      };
}
