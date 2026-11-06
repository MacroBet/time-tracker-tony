import { z } from "zod";
import { assetSchema, type Asset, type Commissioning } from "./commissioning";
import type { Task } from "./domain";

const key = z.string().trim().min(1).max(150);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/, "Use a SHA256 digest");

/** A bounded add-only import. Commissioning work and programme links are separate. */
export const inventoryApplySchema = z
  .object({
    batchId: key,
    sourceSha256: sha256,
    payloadSha256: sha256,
    assets: z.array(assetSchema).min(1).max(10000),
  })
  .strict()
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    input.assets.forEach((asset, index) => {
      if (seen.has(asset.id))
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "id"],
          message: "Duplicate asset ID",
        });
      seen.add(asset.id);
      if (
        asset.levels.length ||
        asset.programmeActivityId ||
        asset.deliveryActivityId ||
        Object.keys(asset.levelActivities ?? {}).length ||
        asset.parentAssetId
      )
        ctx.addIssue({
          code: "custom",
          path: ["assets", index],
          message:
            "Inventory batches add equipment only, without commissioning levels, hierarchy or programme links.",
        });
    });
  });

export const inventoryRestoreSchema = z.object({ batchId: key }).strict();

export const inventoryBatchSchema = z
  .object({
    id: key,
    projectId: key,
    sourceSha256: sha256,
    payloadSha256: sha256,
    contentHash: sha256,
    beforeStateHash: sha256,
    beforeAssetCount: z.number().int().min(0),
    beforeVersion: z.number().int().min(0),
    appliedVersion: z.number().int().min(1),
    appliedAt: z.iso.datetime(),
    actorId: key,
    inserted: z
      .array(z.object({ id: key, contentHash: sha256 }).strict())
      .min(1)
      .max(10000),
    status: z.enum(["applied", "restored"]),
    restoredAt: z.iso.datetime().optional(),
    restoredVersion: z.number().int().min(1).optional(),
    restoredBy: key.optional(),
  })
  .strict();

export type InventoryApply = z.infer<typeof inventoryApplySchema>;
export type InventoryBatch = z.infer<typeof inventoryBatchSchema>;
export type InventoryState = Commissioning & {
  inventoryBatches?: InventoryBatch[];
};
export interface InventoryContext {
  projectId: string;
  actorId: string;
  at: string;
  expectedVersion: number;
  tasks: readonly Task[];
  /** Include references from any additional project feature (e.g. checksheets). */
  assetReferences?: readonly { assetId: string; label: string }[];
}
export interface InventoryBatchResult {
  assets: Asset[];
  batches: InventoryBatch[];
  changes: string[];
  errors: string[];
  updated: boolean;
  insertedCount: number;
  removedCount: number;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, entry]) => [name, canonical(entry)]),
    );
  return value;
}

/** Same browser/server digest; object order and absent optional values are immaterial. */
export async function inventoryFingerprint(value: unknown): Promise<string> {
  const input = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function unchanged(
  state: InventoryState,
  errors: string[] = [],
): InventoryBatchResult {
  return {
    assets: state.assets,
    batches: state.inventoryBatches ?? [],
    changes: [],
    errors,
    updated: false,
    insertedCount: 0,
    removedCount: 0,
  };
}

function contextErrors(
  state: InventoryState,
  context: InventoryContext,
): string[] {
  const errors: string[] = [];
  if (state.version !== context.expectedVersion)
    errors.push("Project changed. Refresh and preview again.");
  if (
    !key.safeParse(context.projectId).success ||
    !key.safeParse(context.actorId).success ||
    !z.iso.datetime().safeParse(context.at).success
  )
    errors.push(
      "Inventory operation requires a project, actor and valid timestamp.",
    );
  if (
    new Set(state.assets.map((asset) => asset.id)).size !== state.assets.length
  )
    errors.push(
      "The existing register contains duplicate IDs; preserve it and resolve the collision first.",
    );
  return errors;
}

/** Pure add-only transition. Caller enforces authorization and optimistic persistence. */
export async function applyInventoryBatch(
  state: InventoryState,
  value: InventoryApply,
  context: InventoryContext,
): Promise<InventoryBatchResult> {
  const checked = inventoryApplySchema.safeParse(value);
  const errors = contextErrors(state, context);
  if (!checked.success)
    errors.push(...checked.error.issues.map((issue) => issue.message));
  if (errors.length || !checked.success) return unchanged(state, errors);
  const input = checked.data;
  const batches = state.inventoryBatches ?? [];
  const oldBatch = batches.find((batch) => batch.id === input.batchId);
  const contentHash = await inventoryFingerprint(input.assets);
  const existing = new Map(state.assets.map((asset) => [asset.id, asset]));

  if (oldBatch) {
    if (
      oldBatch.projectId !== context.projectId ||
      oldBatch.sourceSha256 !== input.sourceSha256 ||
      oldBatch.payloadSha256 !== input.payloadSha256 ||
      oldBatch.contentHash !== contentHash
    )
      return unchanged(state, [
        "Batch ID is already owned by a different project, source or payload.",
      ]);
    if (oldBatch.status === "restored")
      return unchanged(state, [
        "This batch has been restored. Use a new reviewed batch ID to apply it again.",
      ]);
    const actualHashes = await Promise.all(
      oldBatch.inserted.map(async (record) => {
        const asset = existing.get(record.id);
        return asset ? await inventoryFingerprint(asset) : null;
      }),
    );
    if (
      oldBatch.inserted.length !== input.assets.length ||
      oldBatch.inserted.some(
        (record, index) => record.contentHash !== actualHashes[index],
      )
    )
      return unchanged(state, [
        "The saved batch is missing or has changed. Do not overwrite it; refresh and review.",
      ]);
    return unchanged(state);
  }

  const collisions = input.assets.filter((asset) => existing.has(asset.id));
  if (collisions.length)
    return unchanged(state, [
      `${collisions.length} asset IDs already exist outside this batch. No records were changed.`,
    ]);
  if (state.assets.length + input.assets.length > 10000)
    return unchanged(state, ["The resulting inventory exceeds 10,000 assets."]);
  if (batches.length >= 100)
    return unchanged(state, [
      "This project has reached its retained inventory-batch limit.",
    ]);
  const danglingTasks = context.tasks.filter(
    (task) =>
      task.projectId === context.projectId &&
      input.assets.some((asset) => task.cx?.assetId === asset.id),
  );
  const insertedIds = new Set(input.assets.map((asset) => asset.id));
  const external = (context.assetReferences ?? []).filter((reference) =>
    insertedIds.has(reference.assetId),
  );
  if (danglingTasks.length || external.length)
    return unchanged(state, [
      "Proposed IDs already have saved references. Review them before claiming this batch.",
    ]);

  const inserted = await Promise.all(
    input.assets.map(async (asset) => ({
      id: asset.id,
      contentHash: await inventoryFingerprint(asset),
    })),
  );
  const beforeStateHash = await inventoryFingerprint({
    version: state.version,
    assets: state.assets,
    schedule: state.schedule,
    config: state.config,
    programmeId: state.programmeId,
  });
  const batch = inventoryBatchSchema.parse({
    id: input.batchId,
    projectId: context.projectId,
    sourceSha256: input.sourceSha256,
    payloadSha256: input.payloadSha256,
    contentHash,
    beforeStateHash,
    beforeAssetCount: state.assets.length,
    beforeVersion: state.version,
    appliedVersion: state.version + 1,
    appliedAt: context.at,
    actorId: context.actorId,
    inserted,
    status: "applied",
  });
  return {
    assets: [...state.assets, ...input.assets],
    batches: [...batches, batch],
    changes: [
      `Inventory batch ${batch.id}: ${input.assets.length} assets added; no task or programme changes.`,
    ],
    errors: [],
    updated: true,
    insertedCount: input.assets.length,
    removedCount: 0,
  };
}

/** Remove only unchanged additions owned by this batch; retain its audit receipt. */
export async function restoreInventoryBatch(
  state: InventoryState,
  value: z.infer<typeof inventoryRestoreSchema>,
  context: InventoryContext,
): Promise<InventoryBatchResult> {
  const checked = inventoryRestoreSchema.safeParse(value);
  const errors = contextErrors(state, context);
  if (!checked.success)
    errors.push(...checked.error.issues.map((issue) => issue.message));
  if (errors.length || !checked.success) return unchanged(state, errors);
  const batches = state.inventoryBatches ?? [];
  const batch = batches.find((entry) => entry.id === checked.data.batchId);
  if (!batch || batch.projectId !== context.projectId)
    return unchanged(state, ["Inventory batch not found in this project."]);
  const ids = new Set(batch.inserted.map((record) => record.id));
  const existing = new Map(state.assets.map((asset) => [asset.id, asset]));
  if (batch.status === "restored") {
    if (state.assets.some((asset) => ids.has(asset.id)))
      return unchanged(state, [
        "Restored batch IDs have been reused. No records were removed.",
      ]);
    return unchanged(state);
  }
  const actualHashes = await Promise.all(
    batch.inserted.map(async (record) => {
      const asset = existing.get(record.id);
      return asset ? await inventoryFingerprint(asset) : null;
    }),
  );
  if (
    batch.inserted.some(
      (record, index) => record.contentHash !== actualHashes[index],
    )
  )
    return unchanged(state, [
      "Batch assets were changed or removed after import. Restore stopped without deleting anything.",
    ]);
  const tasks = context.tasks.filter(
    (task) =>
      task.projectId === context.projectId &&
      task.cx?.assetId &&
      ids.has(task.cx.assetId),
  );
  const children = state.assets.filter(
    (asset) =>
      !ids.has(asset.id) && asset.parentAssetId && ids.has(asset.parentAssetId),
  );
  const external = (context.assetReferences ?? []).filter((reference) =>
    ids.has(reference.assetId),
  );
  if (tasks.length || children.length || external.length)
    return unchanged(state, [
      "Batch assets now have task, child-asset or checksheet references. Restore stopped without deleting anything.",
    ]);
  return {
    assets: state.assets.filter((asset) => !ids.has(asset.id)),
    batches: batches.map((entry) =>
      entry.id === batch.id
        ? {
            ...entry,
            status: "restored" as const,
            restoredAt: context.at,
            restoredVersion: state.version + 1,
            restoredBy: context.actorId,
          }
        : entry,
    ),
    changes: [
      `Inventory batch ${batch.id}: ${ids.size} unchanged batch-owned assets removed; no task or programme changes.`,
    ],
    errors: [],
    updated: true,
    insertedCount: 0,
    removedCount: ids.size,
  };
}

/** The selected JSON is the source unless a retained receipt records older provenance.
 * Reuse an applied receipt; after removal allocate a new deterministic attempt.
 */
export function inventoryFileIdentity(
  payloadSha256: string,
  batches: readonly InventoryBatch[],
) {
  const previous = batches.filter(
    (batch) => batch.payloadSha256 === payloadSha256,
  );
  const applied = previous.find((batch) => batch.status === "applied");
  if (applied)
    return { batchId: applied.id, sourceSha256: applied.sourceSha256 };
  const base = `json-${payloadSha256}`;
  let batchId = base;
  let attempt = 1;
  while (batches.some((batch) => batch.id === batchId))
    batchId = `${base}-${++attempt}`;
  return { batchId, sourceSha256: payloadSha256 };
}
