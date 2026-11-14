import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { commissioning, type Commissioning } from "../src/lib/commissioning";
import { deleteAssetPreview } from "../src/lib/asset-register-mutations";
import { inventoryRestoreQuery } from "../src/server/db/inventory-restore";
import {
  applyInventoryBatch,
  restoreInventoryBatch,
} from "../src/lib/inventory-batch";
import { workingScheduleSchema } from "../src/lib/schedule-working";
import { projectLessonSchema } from "../src/lib/project-library";
const asset = {
  id: "A",
  name: "Pump",
  equipmentType: "Pump",
  location: "",
  levels: [],
};
const working = workingScheduleSchema.parse({
  sourceSha256: "managed",
  revision: 1,
  activityPatches: [{ internalId: "S", assetIds: ["A"] }],
  addedActivities: [],
  removedLinkIds: [],
  addedLinks: [],
  receipts: [],
});
const lesson = projectLessonSchema.parse({
  id: "L",
  title: "Valve access",
  content: "Keep access clear during testing.",
  source: { projectId: "p", assetId: "A" },
  visibility: "project",
  createdBy: "u",
  createdByName: "Admin",
  updatedBy: "u",
  updatedByName: "Admin",
  createdAt: "2026-11-14T12:00:00Z",
  updatedAt: "2026-11-14T12:00:00Z",
  version: 1,
});
test("asset delete and inventory restore protect explicit working links and lesson provenance", async () => {
  const base: Commissioning = { ...commissioning(), assets: [asset] };
  for (const addition of [
    { workingSchedule: working },
    { lessons: [lesson] },
  ]) {
    const state = { ...base, ...addition };
    assert.equal(deleteAssetPreview(state, "A", []).assets.length, 1);
    assert(deleteAssetPreview(state, "A", []).references.length);
    const input = {
      batchId: "batch",
      sourceSha256: "a".repeat(64),
      payloadSha256: "b".repeat(64),
      assets: [asset],
    };
    const context = {
      projectId: "p",
      actorId: "u",
      at: "2026-11-14T12:00:00Z",
      expectedVersion: 0,
      tasks: [],
    };
    const applied = await applyInventoryBatch(commissioning(), input, context);
    const after = {
      ...base,
      ...addition,
      version: 1,
      inventoryBatches: applied.batches,
    };
    const result = await restoreInventoryBatch(
      after,
      { batchId: "batch" },
      { ...context, expectedVersion: 1 },
    );
    assert(result.errors.length);
    assert.equal(result.removedCount, 0);
  }
});
test("PostgreSQL delete guard protects mapping-only and lesson-only references even without task links", async () => {
  const pg = new PGlite(),
    dialect = new PgDialect();
  try {
    await pg.exec(
      "CREATE TABLE projects(id text primary key,commissioning jsonb);CREATE TABLE tasks(project_id text,cx jsonb);",
    );
    const base = { ...commissioning(), version: 1, assets: [asset] };
    for (const addition of [
      { workingSchedule: working },
      { lessons: [lesson] },
    ]) {
      await pg.query(
        "INSERT INTO projects VALUES('p',$1::jsonb) ON CONFLICT(id) DO UPDATE SET commissioning=excluded.commissioning",
        [JSON.stringify({ ...base, ...addition })],
      );
      const query = dialect.sqlToQuery(
        inventoryRestoreQuery("p", { ...base, version: 2, assets: [] }, 1, [
          "A",
        ]),
      );
      assert.equal((await pg.query(query.sql, query.params)).rows.length, 0);
      const saved = await pg.query<{ commissioning: Commissioning }>(
        "SELECT commissioning FROM projects WHERE id='p'",
      );
      assert.equal(saved.rows[0].commissioning.assets.length, 1);
    }
  } finally {
    await pg.close();
  }
});
