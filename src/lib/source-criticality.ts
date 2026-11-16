import type { SourceProgramme, SourceRecord } from "./programme-source";

export type SourceCriticalityState = "critical" | "non-critical" | "unknown";
export type SourceCriticality = {
  state: SourceCriticalityState;
  totalFloatHours: number | null;
  freeFloatHours: number | null;
  projectId: string | null;
  reason:
    | "saved-total-float"
    | "missing-project-criterion"
    | "unsupported-project-criterion"
    | "missing-float-threshold"
    | "missing-total-float"
    | "invalid-total-float"
    | "not-in-p6-source";
};
export type SourceCriticalityCoverage = {
  total: number;
  critical: number;
  nonCritical: number;
  unknown: number;
};
export type SourceCriticalityCriterion = {
  projectId: string;
  pathType: string;
  thresholdHours: number | null;
  lastRecalculatedAt: string | null;
  supported: boolean;
};
export type SourceCriticalityMetadata = {
  basis: "saved-p6-total-float";
  sourceSha256: string;
  criteria: SourceCriticalityCriterion[];
  coverage: SourceCriticalityCoverage;
  workingStale: boolean;
  workingRevision: number | null;
  recalculation: "not-recalculated";
};

/** Saved P6 hours only. Blank/invalid float never becomes numeric zero. */
const hours = (value: string | undefined): number | null => {
  const text = value?.trim();
  if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};
export function criticalityCoverage(
  activities: readonly { criticality?: SourceCriticality }[],
): SourceCriticalityCoverage {
  const result: SourceCriticalityCoverage = {
    total: activities.length,
    critical: 0,
    nonCritical: 0,
    unknown: 0,
  };
  for (const activity of activities) {
    const state = activity.criticality?.state ?? "unknown";
    if (state === "critical") result.critical++;
    else if (state === "non-critical") result.nonCritical++;
    else result.unknown++;
  }
  return result;
}

/**
 * Interpret only the source's recorded PROJECT CT_TotFloat rule and TASK float.
 * This does not run CPM, infer a longest path or replace missing float with dates/free float.
 */
export function sourceCriticalityReader(programme: SourceProgramme) {
  const table = programme.tables.PROJECT;
  const criteria: SourceCriticalityCriterion[] = (table?.rows ?? []).map(
    (row) => {
      const field = (name: string) => row[table.fields.indexOf(name)]?.trim();
      const pathType = field("critical_path_type") ?? "";
      const thresholdHours = hours(field("critical_drtn_hr_cnt"));
      return {
        projectId: field("proj_id") ?? "",
        pathType,
        thresholdHours,
        lastRecalculatedAt: field("last_recalc_date") || null,
        supported: pathType === "CT_TotFloat" && thresholdHours !== null,
      };
    },
  );
  const byProject = new Map<string, SourceCriticalityCriterion[]>();
  for (const criterion of criteria)
    byProject.set(criterion.projectId, [
      ...(byProject.get(criterion.projectId) ?? []),
      criterion,
    ]);
  return {
    criteria,
    read: (record: SourceRecord): SourceCriticality => {
      const projectId = record.proj_id?.trim() || null;
      const totalFloatHours = hours(record.total_float_hr_cnt);
      const freeFloatHours = hours(record.free_float_hr_cnt);
      const candidates = projectId ? byProject.get(projectId) : undefined;
      const criterion = candidates?.length === 1 ? candidates[0] : undefined;
      const unknown = (
        reason: SourceCriticality["reason"],
      ): SourceCriticality => ({
        state: "unknown",
        totalFloatHours,
        freeFloatHours,
        projectId,
        reason,
      });
      if (!criterion) return unknown("missing-project-criterion");
      if (criterion.pathType !== "CT_TotFloat")
        return unknown("unsupported-project-criterion");
      if (criterion.thresholdHours === null)
        return unknown("missing-float-threshold");
      if (!record.total_float_hr_cnt?.trim())
        return unknown("missing-total-float");
      if (totalFloatHours === null) return unknown("invalid-total-float");
      return {
        state:
          totalFloatHours <= criterion.thresholdHours
            ? "critical"
            : "non-critical",
        totalFloatHours,
        freeFloatHours,
        projectId,
        reason: "saved-total-float",
      };
    },
  };
}
