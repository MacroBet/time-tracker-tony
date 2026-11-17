import { z } from "zod";
import type { Commissioning } from "./commissioning";
import type { SourceProgrammeIndex } from "./programme-source";

export type ProjectProgressActivity = {
  id: string;
  activityId: string;
  internalId?: string;
  name: string;
  source: "source" | "managed";
  plannedFinish?: string;
  actualFinish?: string;
  completed: boolean;
  plannedBasis: "source-target" | "managed-baseline" | null;
};
export type ProjectProgressPopulation = {
  rows: ProjectProgressActivity[];
  revision: { register: number; sourceSha: string | null };
  sourceUnavailable: boolean;
  mirroredManagedActivities: number;
  plannedBasisCoverage: { sourceTarget: number; managedBaseline: number };
};
export type ProjectProgress = {
  asOf: string;
  total: number;
  plannedToday: number | null;
  actualToday: number | null;
  plannedRecorded: number;
  actualRecorded: number;
  completedWithoutActualDate: number;
  futureActualDates: number;
  actualCoveragePartial: boolean;
  sourceUnavailable: boolean;
  plannedBasisCoverage: ProjectProgressPopulation["plannedBasisCoverage"];
  points: { date: string; planned: number | null; actual: number | null }[];
  revision: ProjectProgressPopulation["revision"];
};

/** Accept saved ISO days and P6 timestamps; reject calendar rollover and loose date parsing. */
export function projectProgressDate(value?: string) {
  const match = value
    ?.trim()
    .match(
      /^((?!0000)\d{4}-\d{2}-\d{2})(?:$|[ T](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$)/,
    );
  return match && z.iso.date().safeParse(match[1]).success
    ? match[1]
    : undefined;
}

/** Complete activity population, before any percentages or display sampling. Never mutates the saved source. */
export function projectProgressPopulation(
  state: Commissioning,
  sourceIndex?: SourceProgrammeIndex,
): ProjectProgressPopulation {
  const rows: ProjectProgressActivity[] = [];
  const mirrored = new Set<string>();
  const managedByCode = new Map(
    state.schedule.map((row) => [row.activityId, row]),
  );
  const mirrorsByInternalId = new Map<
    string,
    Commissioning["schedule"][number]
  >();
  const working = state.workingSchedule;
  if (sourceIndex && working?.sourceSha256 === sourceIndex.summary.sha256)
    for (const added of working.addedActivities)
      if (sourceIndex.byId.has(added.internalId)) {
        mirrored.add(added.activityId);
        const mirror = managedByCode.get(added.activityId);
        if (mirror) mirrorsByInternalId.set(added.internalId, mirror);
      }
  for (const activity of sourceIndex?.activities ?? []) {
    const fields = sourceIndex!.byId.get(activity.internalId)?.fields;
    const mirror = mirrorsByInternalId.get(activity.internalId);
    // The displayed finish may already be actual or a working forecast. It is not a planned target.
    const sourceTarget = projectProgressDate(fields?.target_end_date);
    const managedBaseline = projectProgressDate(mirror?.baselineFinish);
    const plannedFinish = sourceTarget ?? managedBaseline;
    const actualFinish =
      projectProgressDate(fields?.act_end_date) ??
      projectProgressDate(mirror?.actualFinish);
    rows.push({
      id: `source:${sourceIndex!.summary.sha256}:${activity.internalId}`,
      activityId: activity.activityId,
      internalId: activity.internalId,
      name: activity.name,
      source: "source",
      plannedFinish,
      actualFinish,
      completed:
        activity.status === "TK_Complete" ||
        Boolean(actualFinish) ||
        mirror?.progress === 100,
      plannedBasis: sourceTarget
        ? "source-target"
        : managedBaseline
          ? "managed-baseline"
          : null,
    });
  }
  let mirroredManagedActivities = 0;
  for (const activity of state.schedule) {
    if (mirrored.has(activity.activityId)) {
      mirroredManagedActivities++;
      continue;
    }
    const plannedFinish = projectProgressDate(activity.baselineFinish);
    const actualFinish = projectProgressDate(activity.actualFinish);
    rows.push({
      id: `managed:${activity.activityId}`,
      activityId: activity.activityId,
      name: activity.name,
      source: "managed",
      plannedFinish,
      actualFinish,
      completed: activity.progress === 100 || Boolean(actualFinish),
      plannedBasis: plannedFinish ? "managed-baseline" : null,
    });
  }
  return {
    rows,
    revision: {
      register: state.version,
      sourceSha:
        state.sourceProgrammeSummary?.sha256 ??
        sourceIndex?.summary.sha256 ??
        null,
    },
    sourceUnavailable: Boolean(state.sourceProgrammeSummary && !sourceIndex),
    mirroredManagedActivities,
    plannedBasisCoverage: {
      sourceTarget: rows.filter((row) => row.plannedBasis === "source-target")
        .length,
      managedBaseline: rows.filter(
        (row) => row.plannedBasis === "managed-baseline",
      ).length,
    },
  };
}

const dayMs = 86_400_000;
const minDay = Date.parse("0001-01-01T00:00:00Z");
const stamp = (day: string) => Date.parse(`${day}T00:00:00Z`);
const dateOf = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Equal activity weights, using only saved planned targets and dated actual completions. */
export function buildProjectProgress(
  population: ProjectProgressPopulation,
  asOf: string,
): ProjectProgress {
  if (projectProgressDate(asOf) !== asOf)
    throw new Error("Choose a valid progress date.");
  const total = population.rows.length;
  const planned = population.rows
    .flatMap((row) => (row.plannedFinish ? [row.plannedFinish] : []))
    .sort();
  const actual = population.rows
    .flatMap((row) => (row.actualFinish ? [row.actualFinish] : []))
    .sort();
  const completedWithoutActualDate = population.rows.filter(
    (row) => row.completed && !row.actualFinish,
  ).length;
  const actualCoveragePartial = completedWithoutActualDate > 0;
  const canPlan =
    total > 0 && planned.length > 0 && !population.sourceUnavailable;
  const canActual =
    total > 0 &&
    (!actualCoveragePartial || actual.length > 0) &&
    !population.sourceUnavailable;
  const percent = (count: number) => Math.round((1000 * count) / total) / 10;
  const plannedToday = canPlan
    ? percent(planned.filter((date) => date <= asOf).length)
    : null;
  const actualToday = canActual
    ? percent(actual.filter((date) => date <= asOf).length)
    : null;
  const dates = [
    ...planned,
    ...actual.filter((date) => date <= asOf),
    asOf,
  ].sort();
  const from = Math.max(minDay, stamp(dates[0]) - 7 * dayMs);
  const through = stamp(dates.at(-1)!);
  // At most 240 dates including the exact as-of date. Long programmes increase sampling interval only.
  const interval =
    Math.max(7, Math.ceil((through - from) / dayMs / 237)) * dayMs;
  const samples = new Set<string>([dateOf(from), dateOf(through), asOf]);
  for (let at = from + interval; at < through; at += interval)
    samples.add(dateOf(at));
  let plannedIndex = 0,
    actualIndex = 0;
  const points = [...samples].sort().map((date) => {
    while (plannedIndex < planned.length && planned[plannedIndex] <= date)
      plannedIndex++;
    while (actualIndex < actual.length && actual[actualIndex] <= date)
      actualIndex++;
    return {
      date,
      planned: canPlan ? percent(plannedIndex) : null,
      actual: canActual && date <= asOf ? percent(actualIndex) : null,
    };
  });
  return {
    asOf,
    total,
    plannedToday,
    actualToday,
    plannedRecorded: planned.length,
    actualRecorded: actual.length,
    completedWithoutActualDate,
    futureActualDates: actual.filter((date) => date > asOf).length,
    actualCoveragePartial,
    sourceUnavailable: population.sourceUnavailable,
    plannedBasisCoverage: population.plannedBasisCoverage,
    points,
    revision: population.revision,
  };
}
