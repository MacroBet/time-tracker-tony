import { z } from "zod";
import {
  recalculateSchedule,
  workingDuration,
  nextWorkday,
  addWorkdays,
} from "./scheduling";
import {
  assetSchema,
  scheduleSchema,
  type Asset,
  type Commissioning,
} from "./commissioning";

export const registerImportSchema = z
  .object({
    assets: z.array(assetSchema).max(10000).default([]),
    schedule: z.array(scheduleSchema).max(15000).default([]),
  })
  .strict()
  .refine(
    (v) => v.assets.length + v.schedule.length > 0,
    "No records to import",
  );
export type RegisterImport = z.infer<typeof registerImportSchema>;
function equivalent(a: unknown, b: unknown): boolean {
  const canonical = (v: unknown): unknown =>
    v && typeof v === "object"
      ? Array.isArray(v)
        ? v.map(canonical)
        : Object.fromEntries(
            Object.entries(v)
              .filter(([, value]) => value !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, canonical(value)]),
          )
      : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
export function mergeRegister(state: Commissioning, input: RegisterImport) {
  const errors: string[] = [],
    changes: string[] = [];
  for (const [name, keys] of [
    ["Asset", input.assets.map((a) => a.id)],
    ["Activity ID", input.schedule.map((s) => s.activityId)],
  ] as const) {
    if (new Set(keys).size !== keys.length)
      errors.push(`Duplicate ${name} in import.`);
  }
  const assets = new Map(state.assets.map((a) => [a.id, a]));
  const schedule = new Map(state.schedule.map((s) => [s.activityId, s]));
  for (const row of input.schedule) {
    const old = schedule.get(row.activityId);
    const next = {
      ...old,
      ...Object.fromEntries(
        Object.entries(row).filter(([, value]) => value !== undefined),
      ),
      activityId: row.activityId,
      name: row.name,
    } as import("./commissioning").ScheduleActivity;
    const managed =
      next.durationDays !== undefined || (next.predecessors?.length ?? 0) > 0;
    // Legacy date-based edits to managed rows become explicit constraints. An
    // exported notBefore/duration pair remains authoritative over derived dates.
    if (managed && !next.actualFinish) {
      if (row.notBefore === undefined && row.start !== undefined)
        next.notBefore = row.start;
      if (row.durationDays === undefined && row.finish !== undefined) {
        const start = row.start ?? row.notBefore ?? next.start;
        if (start) {
          try {
            next.durationDays = workingDuration(start, row.finish);
          } catch {
            errors.push(
              `${row.activityId}: finish must follow the requested start.`,
            );
          }
        }
      } else if (
        row.notBefore === undefined &&
        row.start &&
        row.finish &&
        row.durationDays !== undefined
      ) {
        try {
          if (
            addWorkdays(nextWorkday(row.start), row.durationDays - 1) !==
            row.finish
          )
            errors.push(
              `${row.activityId}: finish conflicts with the working-day duration. Correct durationDays, or omit finish to recalculate it.`,
            );
        } catch {
          errors.push(
            `${row.activityId}: invalid managed activity date range.`,
          );
        }
      }
    }
    next.baselineStart =
      old?.baselineStart ??
      row.baselineStart ??
      (managed ? undefined : row.start);
    next.baselineFinish =
      old?.baselineFinish ??
      row.baselineFinish ??
      (managed ? undefined : row.finish);
    if (!equivalent(old, next)) {
      changes.push(
        `${row.activityId}: ${old ? `forecast ${old.finish ?? "undated"} → ${next.finish ?? "undated"}` : "schedule added"}`,
      );
      schedule.set(row.activityId, next);
    }
  }
  for (const row of input.assets) {
    const old = assets.get(row.id);
    const next = { ...row };
    // Older exports do not contain these fields. Keep their recorded values;
    // null (supply) and an empty string (metadata) explicitly clear them.
    for (const field of [
      "clientSupplied",
      "discipline",
      "parentAssetId",
      "serialNumber",
      "owner",
      "phase",
      "floor",
      "area",
    ] as const) {
      if (row[field] === undefined && old?.[field] !== undefined) {
        Object.assign(next, { [field]: old[field] });
      }
    }
    if (
      row.levels.some(
        (l) =>
          !state.config.levels.includes(l) &&
          !assets.get(row.id)?.levels.includes(l),
      )
    )
      errors.push(`${row.id}: enable its levels in project setup first.`);
    if (row.deliveryActivityId && !schedule.has(row.deliveryActivityId))
      errors.push(`${row.id}: delivery Activity ID not found.`);
    for (const [level, id] of Object.entries(row.levelActivities ?? {})) {
      if (
        !row.levels.includes(level as (typeof row.levels)[number]) ||
        !schedule.has(id)
      )
        errors.push(`${row.id}: invalid ${level} Activity ID link.`);
    }
    if (!equivalent(assets.get(row.id), next)) {
      changes.push(
        `${row.id}: ${assets.has(row.id) ? "asset updated" : "asset added"}`,
      );
      assets.set(row.id, next);
    }
  }
  errors.push(...validateAssetHierarchy([...assets.values()]));
  const calculated = recalculateSchedule([...schedule.values()]);
  errors.push(...calculated.errors);
  changes.push(...calculated.changes);
  return {
    errors,
    changes,
    assets: [...assets.values()],
    schedule: calculated.schedule,
  };
}

/** A parent is another stable asset ID in this project, never a phase name. */
export function validateAssetHierarchy(assets: Asset[]): string[] {
  const records = new Map(assets.map((asset) => [asset.id, asset]));
  const errors: string[] = [];
  const visited = new Set<string>();
  for (const asset of assets) {
    if (asset.parentAssetId === asset.id)
      errors.push(`${asset.id}: an asset cannot be its own parent.`);
    else if (asset.parentAssetId && !records.has(asset.parentAssetId))
      errors.push(
        `${asset.id}: parent asset ${asset.parentAssetId} not found in this project.`,
      );
  }
  for (const asset of assets) {
    if (visited.has(asset.id)) continue;
    const chain = new Map<string, number>();
    let current: string | undefined = asset.id;
    while (current && records.has(current) && !visited.has(current)) {
      if (chain.has(current)) {
        errors.push(
          `Asset parent cycle: ${[...chain.keys()].slice(chain.get(current)).join(" → ")} → ${current}.`,
        );
        break;
      }
      chain.set(current, chain.size);
      const parent: string | undefined = records.get(current)?.parentAssetId;
      if (parent === current) break;
      current = parent;
    }
    for (const id of chain.keys()) visited.add(id);
  }
  return errors;
}
