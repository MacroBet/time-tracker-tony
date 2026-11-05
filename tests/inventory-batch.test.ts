import test from "node:test";
import assert from "node:assert/strict";
import { commissioning, type Asset } from "../src/lib/commissioning";
import type { Task } from "../src/lib/domain";
import {
  applyInventoryBatch,
  restoreInventoryBatch,
  inventoryApplySchema,
  inventoryFingerprint,
  type InventoryContext,
  type InventoryState,
} from "../src/lib/inventory-batch";

const asset = (id: string): Asset => ({
  id,
  name: id,
  equipmentType: "Pump",
  location: "",
  levels: [],
});
const context = (expectedVersion = 0): InventoryContext => ({
  projectId: "project-a",
  actorId: "admin-a",
  at: "2026-11-05T16:00:00.000Z",
  expectedVersion,
  tasks: [],
});
const input = (assets = [asset("new-a"), asset("new-b")]) => ({
  batchId: "inventory-a",
  sourceSha256: "a".repeat(64),
  payloadSha256: "b".repeat(64),
  assets,
});
async function applied(): Promise<InventoryState> {
  const state = { ...commissioning(), assets: [asset("old-a")] };
  const result = await applyInventoryBatch(state, input(), context());
  assert.deepEqual(result.errors, []);
  return {
    ...state,
    version: 1,
    assets: result.assets,
    inventoryBatches: result.batches,
  };
}

test("add-only batch preserves old inventory, schedule and caller input; identical reapply is a no-op", async () => {
  const state = {
    ...commissioning(),
    assets: [asset("old-a")],
    schedule: [
      { activityId: "old-schedule", name: "Preserve", finish: "2026-11-12" },
    ],
  };
  const before = structuredClone(state);
  const first = await applyInventoryBatch(state, input(), context());
  assert.equal(first.insertedCount, 2);
  assert.deepEqual(
    first.assets.map((a) => a.id),
    ["old-a", "new-a", "new-b"],
  );
  assert.deepEqual(state, before);
  const next = {
    ...state,
    version: 1,
    assets: first.assets,
    inventoryBatches: first.batches,
  };
  const again = await applyInventoryBatch(next, input(), context(1));
  assert.equal(again.updated, false);
  assert.deepEqual(again.errors, []);
  assert.strictEqual(again.assets, next.assets);
  assert.equal(first.batches[0].beforeVersion, 0);
  assert.equal(first.batches[0].appliedVersion, 1);
  assert.match(first.batches[0].beforeStateHash, /^[a-f0-9]{64}$/);
});

test("stale snapshots, collisions and reused batch identity cannot overwrite records", async () => {
  const state = await applied();
  assert.match(
    (await applyInventoryBatch(state, input(), context(0))).errors[0],
    /Project changed/,
  );
  assert.match(
    (
      await applyInventoryBatch(
        state,
        { ...input(), batchId: "new-batch" },
        context(1),
      )
    ).errors[0],
    /already exist/,
  );
  assert.match(
    (
      await applyInventoryBatch(
        state,
        { ...input(), payloadSha256: "c".repeat(64) },
        context(1),
      )
    ).errors[0],
    /different project, source or payload/,
  );
  state.assets[1] = { ...state.assets[1], name: "Edited" };
  const result = await applyInventoryBatch(state, input(), context(1));
  assert.equal(result.updated, false);
  assert.match(result.errors[0], /saved batch is missing or has changed/);
});

test("restoration removes only owned unchanged additions and retains receipts, later assets and original state", async () => {
  const state = await applied();
  state.assets.push(asset("later-unrelated"));
  const before = structuredClone(state);
  const result = await restoreInventoryBatch(
    state,
    { batchId: "inventory-a" },
    context(1),
  );
  assert.equal(result.removedCount, 2);
  assert.deepEqual(
    result.assets.map((a) => a.id),
    ["old-a", "later-unrelated"],
  );
  assert.equal(result.batches[0].status, "restored");
  assert.equal(result.batches[0].restoredVersion, 2);
  assert.deepEqual(state, before);
  const restored = {
    ...state,
    version: 2,
    assets: result.assets,
    inventoryBatches: result.batches,
  };
  const again = await restoreInventoryBatch(
    restored,
    { batchId: "inventory-a" },
    context(2),
  );
  assert.equal(again.updated, false);
  assert.deepEqual(again.errors, []);
  assert.match(
    (await applyInventoryBatch(restored, input(), context(2))).errors[0],
    /new reviewed batch ID/,
  );
});

test("restoration blocks edited/missing assets and every saved reference without partial deletion", async () => {
  for (const kind of [
    "edit",
    "missing",
    "task",
    "child",
    "checksheet",
  ] as const) {
    const state = await applied();
    const ctx = context(1);
    if (kind === "edit")
      state.assets[1] = { ...state.assets[1], phase: "Changed" };
    if (kind === "missing")
      state.assets = state.assets.filter((a) => a.id !== "new-a");
    if (kind === "task")
      ctx.tasks = [
        {
          id: "work",
          projectId: "project-a",
          cx: { assetId: "new-a" },
        } as Task,
      ];
    if (kind === "child")
      state.assets.push({ ...asset("child"), parentAssetId: "new-a" });
    if (kind === "checksheet")
      ctx.assetReferences = [{ assetId: "new-a", label: "Sheet 1" }];
    const before = structuredClone(state);
    const result = await restoreInventoryBatch(
      state,
      { batchId: "inventory-a" },
      ctx,
    );
    assert.equal(result.updated, false, kind);
    assert(result.errors.length, kind);
    assert.deepEqual(state, before);
    assert.strictEqual(result.assets, state.assets);
  }
});

test("project scoping prevents foreign restore; unrelated project task IDs do not block", async () => {
  const state = await applied();
  assert.match(
    (
      await restoreInventoryBatch(
        state,
        { batchId: "inventory-a" },
        { ...context(1), projectId: "foreign" },
      )
    ).errors[0],
    /not found/,
  );
  const result = await restoreInventoryBatch(
    state,
    { batchId: "inventory-a" },
    {
      ...context(1),
      tasks: [{ projectId: "foreign", cx: { assetId: "new-a" } } as Task],
    },
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.removedCount, 2);
});

test("inventory schema excludes generated commissioning work and source links; fingerprint is canonical", async () => {
  assert(
    !inventoryApplySchema.safeParse(
      input([{ ...asset("bad"), levels: ["L1"] }]),
    ).success,
  );
  assert(
    !inventoryApplySchema.safeParse(
      input([{ ...asset("bad"), programmeActivityId: "P6-a" }]),
    ).success,
  );
  assert(
    !inventoryApplySchema.safeParse(input([asset("same"), asset("same")]))
      .success,
  );
  assert(!inventoryApplySchema.safeParse(input([])).success);
  assert.equal(
    await inventoryFingerprint({ a: 1, b: 2, missing: undefined }),
    await inventoryFingerprint({ b: 2, a: 1 }),
  );
});

test("full sized fixture preserves all1354 rows and restores completely without name deduplication", async () => {
  const assets = Array.from({ length: 1354 }, (_, index) => ({
    ...asset(`inv-${index}`),
    name: index % 2 ? "Repeated" : "Repeated",
  }));
  const state = commissioning();
  const first = await applyInventoryBatch(state, input(assets), context());
  assert.deepEqual(first.errors, []);
  assert.equal(first.assets.length, 1354);
  const next = {
    ...state,
    version: 1,
    assets: first.assets,
    inventoryBatches: first.batches,
  };
  assert.equal(
    (await applyInventoryBatch(next, input(assets), context(1))).updated,
    false,
  );
  const result = await restoreInventoryBatch(
    next,
    { batchId: "inventory-a" },
    context(1),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.assets.length, 0);
  assert.equal(result.removedCount, 1354);
});
