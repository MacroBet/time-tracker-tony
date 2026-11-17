import { dayNumber } from "./scheduling";

export type GanttDateRange = { start?: string; finish?: string };
export type GanttDateDragMode = "move" | "start" | "finish";
export type GanttDragRow = GanttDateRange & {
  id: string;
  milestone?: boolean;
};

const firstDay = dayNumber("0001-01-01");
const lastDay = dayNumber("9999-12-31");
const at = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** Positive drags move work later; half-day snapping is symmetric in both directions. */
export function ganttDateDelta(pixels: number, pixelsPerDay: number): number {
  if (
    !Number.isFinite(pixels) ||
    !Number.isFinite(pixelsPerDay) ||
    pixelsPerDay <= 0
  )
    return 0;
  const days = Math.round(Math.abs(pixels) / pixelsPerDay);
  return days ? Math.sign(pixels) * days : 0;
}

/** A drag creates an explicit proposal; it never fills an unrecorded endpoint. */
export function dragGanttDates(
  row: GanttDragRow,
  mode: GanttDateDragMode,
  days: number,
): GanttDateRange | null {
  if (!Number.isSafeInteger(days)) return null;
  const start = row.start === undefined ? undefined : dayNumber(row.start);
  const finish = row.finish === undefined ? undefined : dayNumber(row.finish);
  if (
    (start !== undefined && !Number.isFinite(start)) ||
    (finish !== undefined && !Number.isFinite(finish)) ||
    (start === undefined && finish === undefined) ||
    (start !== undefined && finish !== undefined && finish < start)
  )
    return null;
  if (
    mode !== "move" &&
    (row.milestone || start === undefined || finish === undefined)
  )
    return null;
  if (mode === "move") {
    const dates = [start, finish].filter(
      (value): value is number => value !== undefined,
    );
    const offset = clamp(
      days,
      firstDay - Math.min(...dates),
      lastDay - Math.max(...dates),
    );
    return {
      ...(start !== undefined ? { start: at(start + offset) } : {}),
      ...(finish !== undefined ? { finish: at(finish + offset) } : {}),
    };
  }
  return mode === "start"
    ? { start: at(clamp(start! + days, firstDay, finish!)), finish: row.finish }
    : { start: row.start, finish: at(clamp(finish! + days, start!, lastDay)) };
}
