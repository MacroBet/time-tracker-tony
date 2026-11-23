import { z } from "zod";
import type { Commissioning } from "./commissioning";
import type { SourceProgrammeIndex } from "./programme-source";
import type {
  SourceCriticalityCoverage,
  SourceCriticalityState,
} from "./source-criticality";

export type ProjectProgressActivity = {
  id: string;
  activityId: string;
  internalId?: string;
  name: string;
  source: "source" | "managed";
  plannedFinish?: string;
  actualFinish?: string;
  currentFinish?: string;
  criticality: SourceCriticalityState;
  completed: boolean;
  plannedBasis: "source-target" | "managed-baseline" | null;
};
export type ProjectProgressPopulation = {
  rows: ProjectProgressActivity[];
  revision: { register: number; sourceSha: string | null };
  sourceUnavailable: boolean;
  mirroredManagedActivities: number;
  plannedBasisCoverage: { sourceTarget: number; managedBaseline: number };
  criticality: {
    coverage: SourceCriticalityCoverage;
    workingStale: boolean;
  };
};
export type ProjectProgressSeries = {
  asOf: string;
  total: number;
  plannedToday: number | null;
  actualToday: number | null;
  currentToday: number | null;
  plannedRecorded: number;
  actualRecorded: number;
  currentRecorded: number;
  completedWithoutActualDate: number;
  futureActualDates: number;
  actualCoveragePartial: boolean;
  sourceUnavailable: boolean;
  points: {
    date: string;
    planned: number | null;
    actual: number | null;
    current: number | null;
  }[];
};
export type ProjectProgress = ProjectProgressSeries & {
  plannedBasisCoverage: ProjectProgressPopulation["plannedBasisCoverage"];
  revision: ProjectProgressPopulation["revision"];
  criticalPath: {
    series: ProjectProgressSeries;
    coverage: SourceCriticalityCoverage;
    workingStale: boolean;
  } | null;
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
      currentFinish: projectProgressDate(activity.finish),
      criticality: activity.criticality?.state ?? "unknown",
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
      currentFinish: projectProgressDate(activity.finish),
      criticality: "unknown",
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
    criticality: {
      coverage: {
        total: rows.length,
        critical: rows.filter((row) => row.criticality === "critical").length,
        nonCritical: rows.filter((row) => row.criticality === "non-critical")
          .length,
        unknown: rows.filter((row) => row.criticality === "unknown").length,
      },
      workingStale: sourceIndex?.criticality?.workingStale ?? false,
    },
  };
}

const dayMs = 86_400_000;
const minDay = Date.parse("0001-01-01T00:00:00Z");
const stamp = (day: string) => Date.parse(`${day}T00:00:00Z`);
const dateOf = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Equal activity weights. Current saved finishes never replace original planned dates. */
function buildProgressSeries(
  rows: ProjectProgressActivity[],
  sourceUnavailable: boolean,
  asOf: string,
): ProjectProgressSeries {
  const total = rows.length;
  const planned = rows
    .flatMap((row) => (row.plannedFinish ? [row.plannedFinish] : []))
    .sort();
  const actual = rows
    .flatMap((row) => (row.actualFinish ? [row.actualFinish] : []))
    .sort();
  const current = rows
    .flatMap((row) => (row.currentFinish ? [row.currentFinish] : []))
    .sort();
  const completedWithoutActualDate = rows.filter(
    (row) => row.completed && !row.actualFinish,
  ).length;
  const actualCoveragePartial = completedWithoutActualDate > 0;
  const canPlan = total > 0 && planned.length > 0 && !sourceUnavailable;
  const canCurrent = total > 0 && current.length > 0 && !sourceUnavailable;
  const canActual =
    total > 0 &&
    (!actualCoveragePartial || actual.length > 0) &&
    !sourceUnavailable;
  const percent = (count: number) => Math.round((1000 * count) / total) / 10;
  const plannedToday = canPlan
    ? percent(planned.filter((date) => date <= asOf).length)
    : null;
  const actualToday = canActual
    ? percent(actual.filter((date) => date <= asOf).length)
    : null;
  const currentToday = canCurrent
    ? percent(current.filter((date) => date <= asOf).length)
    : null;
  const dates = [
    ...planned,
    ...current,
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
    actualIndex = 0,
    currentIndex = 0;
  const points = [...samples].sort().map((date) => {
    while (plannedIndex < planned.length && planned[plannedIndex] <= date)
      plannedIndex++;
    while (actualIndex < actual.length && actual[actualIndex] <= date)
      actualIndex++;
    while (currentIndex < current.length && current[currentIndex] <= date)
      currentIndex++;
    return {
      date,
      planned: canPlan ? percent(plannedIndex) : null,
      actual: canActual && date <= asOf ? percent(actualIndex) : null,
      current: canCurrent ? percent(currentIndex) : null,
    };
  });
  return {
    asOf,
    total,
    plannedToday,
    actualToday,
    currentToday,
    plannedRecorded: planned.length,
    actualRecorded: actual.length,
    currentRecorded: current.length,
    completedWithoutActualDate,
    futureActualDates: actual.filter((date) => date > asOf).length,
    actualCoveragePartial,
    sourceUnavailable,
    points,
  };
}

/** Only saved P6 critical classification is selected; no current or phase-specific CPM is inferred. */
export function buildProjectProgress(
  population: ProjectProgressPopulation,
  asOf: string,
): ProjectProgress {
  if (projectProgressDate(asOf) !== asOf)
    throw new Error("Choose a valid progress date.");
  const critical = population.rows.filter(
    (row) => row.criticality === "critical",
  );
  return {
    ...buildProgressSeries(population.rows, population.sourceUnavailable, asOf),
    plannedBasisCoverage: population.plannedBasisCoverage,
    revision: population.revision,
    criticalPath: critical.length
      ? {
          series: buildProgressSeries(
            critical,
            population.sourceUnavailable,
            asOf,
          ),
          coverage: population.criticality.coverage,
          workingStale: population.criticality.workingStale,
        }
      : null,
  };
}
