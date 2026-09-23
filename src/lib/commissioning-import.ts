import { z } from "zod";
import {
  assetSchema,
  scheduleSchema,
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
      baselineStart: old?.baselineStart ?? row.baselineStart ?? row.start,
      baselineFinish: old?.baselineFinish ?? row.baselineFinish ?? row.finish,
    };
    if (!equivalent(old, next)) {
      changes.push(
        `${row.activityId}: ${old ? `forecast ${old.finish ?? "undated"} → ${next.finish ?? "undated"}` : "schedule added"}`,
      );
      schedule.set(row.activityId, next);
    }
  }
  for (const row of input.assets) {
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
    if (!equivalent(assets.get(row.id), row)) {
      changes.push(
        `${row.id}: ${assets.has(row.id) ? "asset updated" : "asset added"}`,
      );
      assets.set(row.id, row);
    }
  }
  return {
    errors,
    changes,
    assets: [...assets.values()],
    schedule: [...schedule.values()],
  };
}
