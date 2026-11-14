import { z } from "zod";
import { LEVELS, type Asset, type Commissioning } from "./commissioning";
import type { Task } from "./domain";

const id = z.string().trim().min(1).max(150);
const levels = z
  .array(z.enum(LEVELS))
  .max(LEVELS.length)
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate tag levels",
  );
export const assetTagsSchema = z
  .object({
    updates: z
      .array(z.object({ assetId: id, levels }).strict())
      .min(1)
      .max(1000),
  })
  .strict()
  .refine(
    ({ updates }) =>
      new Set(updates.map((row) => row.assetId)).size === updates.length,
    "Choose each asset once",
  );
export const assetDeleteSchema = z.object({ assetId: id }).strict();
export type AssetTagsCommand = z.infer<typeof assetTagsSchema>;

/** Applicability is configuration only. Tasks, results, signatures and links stay intact. */
export function updateAssetTags(
  state: Commissioning,
  command: AssetTagsCommand,
  tasks: Task[],
) {
  const changes: string[] = [],
    errors: string[] = [];
  const updates = new Map(
    command.updates.map((row) => [row.assetId, row.levels]),
  );
  for (const update of command.updates) {
    const asset = state.assets.find((row) => row.id === update.assetId);
    if (!asset) {
      errors.push(
        `${update.assetId}: asset is no longer available in this project.`,
      );
      continue;
    }
    for (const level of update.levels) {
      if (!asset.levels.includes(level) && !state.config.levels.includes(level))
        errors.push(`${asset.name}: enable ${level} in project setup first.`);
    }
    for (const level of asset.levels.filter(
      (value) => !update.levels.includes(value),
    )) {
      const references = [
        ...tasks
          .filter(
            (task) => task.cx?.assetId === asset.id && task.cx.level === level,
          )
          .map((task) => `task ${task.title}`),
        ...(state.checksheets?.sheets ?? [])
          .filter(
            (sheet) => sheet.assetId === asset.id && sheet.level === level,
          )
          .map((sheet) => `checksheet ${sheet.templateName}`),
        ...(asset.levelActivities?.[level]
          ? [`Schedule activity ${asset.levelActivities[level]}`]
          : []),
      ];
      if (references.length)
        errors.push(
          `${asset.name}: keep ${level}; linked to ${references.join(", ")}.`,
        );
    }
    if (
      LEVELS.some(
        (level) =>
          asset.levels.includes(level) !== update.levels.includes(level),
      )
    )
      changes.push(
        `${asset.name} (${asset.id}): required tags ${asset.levels.join(", ") || "none"} → ${update.levels.join(", ") || "none"}`,
      );
  }
  return {
    errors,
    changes,
    assets: errors.length
      ? state.assets
      : state.assets.map((asset) => {
          const next = updates.get(asset.id);
          return next ? { ...asset, levels: [...next] } : asset;
        }),
  };
}

/** The form/import path must enforce the same removal rules against the saved state. */
export function assetTagEditErrors(
  state: Commissioning,
  proposed: Asset[],
  tasks: Task[],
) {
  const existing = new Set(state.assets.map((asset) => asset.id));
  return updateAssetTags(
    state,
    {
      updates: proposed
        .filter((asset) => existing.has(asset.id))
        .map((asset) => ({ assetId: asset.id, levels: asset.levels })),
    },
    tasks,
  ).errors;
}

export function deleteAssetPreview(
  state: Commissioning,
  assetId: string,
  tasks: Task[],
) {
  const asset = state.assets.find((row) => row.id === assetId);
  const references = [
    ...tasks
      .filter((task) => task.cx?.assetId === assetId)
      .map((task) => `Task: ${task.title}`),
    ...state.assets
      .filter((row) => row.parentAssetId === assetId)
      .map((row) => `Child asset: ${row.name}`),
    ...(state.checksheets?.sheets ?? [])
      .filter((sheet) => sheet.assetId === assetId)
      .map((sheet) => `Checksheet: ${sheet.templateName}`),
    ...(state.checksheets?.worksToGo ?? [])
      .filter((work) => work.assetId === assetId)
      .map((work) => `Works to go: ${work.title}`),
    ...(asset?.programmeActivityId
      ? [`Schedule activity: ${asset.programmeActivityId}`]
      : []),
    ...(asset?.deliveryActivityId
      ? [`Delivery activity: ${asset.deliveryActivityId}`]
      : []),
    ...Object.entries(asset?.levelActivities ?? {}).map(
      ([level, activity]) => `${level} Schedule activity: ${activity}`,
    ),
  ];
  const errors = !asset
    ? ["Asset is no longer available in this project."]
    : references.length
      ? [
          "This asset has linked records. Remove or reassign those links before deleting it.",
        ]
      : [];
  return {
    errors,
    references,
    changes:
      errors.length || !asset
        ? []
        : [`Delete asset ${asset.name} (${asset.id})`],
    assets: errors.length
      ? state.assets
      : state.assets.filter((row) => row.id !== assetId),
  };
}

/** New identity, inventory/configuration only: no serial, ownership, programme or test history. */
export function duplicateAssetDraft(asset: Asset): Asset {
  return {
    id: "",
    name: `${asset.name} copy`.slice(0, 150),
    equipmentType: asset.equipmentType,
    location: asset.location,
    phase: asset.phase,
    floor: asset.floor,
    area: asset.area,
    discipline: asset.discipline,
    clientSupplied: asset.clientSupplied,
    levels: [...asset.levels],
  };
}
