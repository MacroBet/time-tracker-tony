import test from "node:test";
import assert from "node:assert/strict";
import {
  commissioning,
  type Asset,
  type Commissioning,
} from "../src/lib/commissioning";
import type { Task } from "../src/lib/domain";
import {
  assetTagsSchema,
  deleteAssetPreview,
  duplicateAssetDraft,
  updateAssetTags,
  assetTagEditErrors,
} from "../src/lib/asset-register-mutations";

const asset = (id: string, fields: Partial<Asset> = {}): Asset => ({
  id,
  name: `Pump ${id}`,
  equipmentType: "Pump",
  location: "Roof",
  levels: ["L1"],
  ...fields,
});
const state = (): Commissioning => ({
  ...commissioning(),
  config: { levels: ["L1", "L2", "L3"], priorities: ["P1"] },
  assets: [asset("a"), asset("b")],
  schedule: [
    {
      activityId: "saved",
      name: "Saved activity",
      start: "2026-11-12",
      finish: "2026-11-14",
    },
  ],
});

test("form/import edits retain checksheet-only and saved Schedule level references, including disabled existing levels", () => {
  const before = state();
  before.config.levels = [];
  before.assets[0].levelActivities = { L1: "saved" };
  before.checksheets = {
    templates: [],
    signatorySlots: [],
    worksToGo: [],
    sheets: [
      {
        id: "sheet",
        assetId: "b",
        templateId: "template",
        templateName: "Checksheet only",
        templateRevision: "1",
        level: "L1",
        requirements: [],
        responses: [],
        signatures: [],
        createdBy: "u",
        createdAt: "2026-11-14T10:00:00.000Z",
      },
    ],
  };
  const snapshot = structuredClone(before);
  const errors = assetTagEditErrors(
    before,
    before.assets.map((asset) => ({
      ...asset,
      name: `${asset.name} edited`,
      levels: [],
      levelActivities: {},
    })),
    [],
  );
  assert.equal(errors.length, 2);
  assert(errors.some((error) => error.includes("Checksheet only")));
  assert(errors.some((error) => error.includes("Schedule activity saved")));
  assert.deepEqual(
    assetTagEditErrors(
      before,
      before.assets.map((asset) => ({
        ...asset,
        name: `${asset.name} edited`,
      })),
      [],
    ),
    [],
    "Retaining a disabled existing level still permits metadata edits",
  );
  assert.deepEqual(before, snapshot);
});

test("bulk applicability changes only explicitly selected levels, preserving all asset metadata and schedule", () => {
  const before = state();
  before.assets[0] = asset("a", {
    clientAssetId: "CLIENT",
    serialNumber: "SERIAL",
    owner: "Owner",
    levelActivities: { L1: "saved" },
  });
  const snapshot = structuredClone(before);
  const result = updateAssetTags(
    before,
    { updates: [{ assetId: "a", levels: ["L1", "L2"] }] },
    [],
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.assets[0], {
    ...before.assets[0],
    levels: ["L1", "L2"],
  });
  assert.equal(result.assets[1], before.assets[1]);
  assert.deepEqual(before, snapshot);
});

test("a protected removal rejects the complete selection, including unreferenced targets", () => {
  const before = state();
  const tasks = [
    {
      id: "task",
      title: "Signed test",
      status: "completed",
      cx: {
        kind: "tag",
        assetId: "a",
        level: "L1",
        result: "passed",
        tagReview: "approved",
      },
    },
  ] as Task[];
  const result = updateAssetTags(
    before,
    {
      updates: [
        { assetId: "a", levels: [] },
        { assetId: "b", levels: ["L2"] },
      ],
    },
    tasks,
  );
  assert(result.errors.some((error) => error.includes("Signed test")));
  assert.equal(result.assets, before.assets);
  assert.equal(tasks[0].cx?.result, "passed");
});

test("checksheet and per-level Schedule links protect applicability independently of task presence", () => {
  const before = state();
  before.assets[0].levelActivities = { L1: "saved" };
  before.checksheets = {
    templates: [],
    signatorySlots: [],
    worksToGo: [],
    sheets: [
      {
        id: "sheet",
        assetId: "b",
        templateId: "template",
        templateName: "Recorded checks",
        templateRevision: "1",
        level: "L1",
        requirements: [],
        responses: [],
        signatures: [],
        createdBy: "u",
        createdAt: "2026-11-14T10:00:00.000Z",
      },
    ],
  };
  const result = updateAssetTags(
    before,
    {
      updates: [
        { assetId: "a", levels: [] },
        { assetId: "b", levels: [] },
      ],
    },
    [],
  );
  assert.equal(result.errors.length, 2);
  assert(result.errors.some((error) => error.includes("checksheet")));
  assert(result.errors.some((error) => error.includes("Schedule activity")));
  assert.equal(result.assets, before.assets);
});

test("unknown assets, disabled new levels and duplicate targets cannot apply silently", () => {
  const before = state();
  const result = updateAssetTags(
    before,
    {
      updates: [
        { assetId: "a", levels: ["L6"] },
        { assetId: "gone", levels: [] },
      ],
    },
    [],
  );
  assert.equal(result.errors.length, 2);
  assert.equal(result.assets, before.assets);
  assert.equal(
    assetTagsSchema.safeParse({
      updates: [
        { assetId: "a", levels: [] },
        { assetId: "a", levels: [] },
      ],
    }).success,
    false,
  );
  assert.equal(
    assetTagsSchema.safeParse({
      updates: [{ assetId: "a", levels: ["L1", "L1"] }],
    }).success,
    false,
  );
  assert.equal(
    assetTagsSchema.safeParse({
      updates: [{ assetId: "a", levels: [], result: "passed" }],
    }).success,
    false,
  );
});

test("deletion blocks every linked record and preserves all state while the preview is blocked", () => {
  const before = state();
  before.assets[0] = asset("a", {
    programmeActivityId: "saved",
    deliveryActivityId: "saved",
    levelActivities: { L1: "saved" },
  });
  before.assets[1].parentAssetId = "a";
  before.checksheets = {
    templates: [],
    signatorySlots: [],
    sheets: [
      {
        id: "sheet",
        assetId: "a",
        templateId: "template",
        templateName: "Recorded checks",
        templateRevision: "1",
        requirements: [],
        responses: [],
        signatures: [],
        createdBy: "u",
        createdAt: "2026-11-14T10:00:00.000Z",
      },
    ],
    worksToGo: [
      {
        id: "work",
        assetId: "a",
        title: "Closed work",
        notes: "",
        status: "done",
        createdBy: "u",
        updatedBy: "u",
        createdAt: "2026-11-14T10:00:00.000Z",
        updatedAt: "2026-11-14T10:00:00.000Z",
      },
    ],
  };
  const result = deleteAssetPreview(before, "a", [
    { title: "Tag record", cx: { assetId: "a" } },
  ] as Task[]);
  assert.equal(result.references.length, 7);
  assert.equal(result.errors.length, 1);
  assert.equal(result.assets, before.assets);
  assert.deepEqual(result.changes, []);
  const clean = state(),
    removed = deleteAssetPreview(clean, "a", []);
  assert.deepEqual(removed.errors, []);
  assert.deepEqual(
    removed.assets.map((row) => row.id),
    ["b"],
  );
  assert.equal(clean.assets.length, 2, "Preview is immutable");
});

test("duplicate drafts have no identity, client/programme links, serial or attestations from the source", () => {
  const source = asset("a", {
    clientAssetId: "CLIENT",
    programmeActivityId: "saved",
    deliveryActivityId: "saved",
    levelActivities: { L1: "saved" },
    serialNumber: "SERIAL",
    owner: "Owner",
    parentAssetId: "parent",
    expectedDelivery: "2026-11-14",
    phase: "FR1",
    area: "North",
  });
  const result = duplicateAssetDraft(source);
  assert.equal(result.id, "");
  assert.equal(result.name, "Pump a copy");
  assert.equal(result.phase, "FR1");
  assert.equal(result.area, "North");
  for (const key of [
    "clientAssetId",
    "programmeActivityId",
    "deliveryActivityId",
    "levelActivities",
    "serialNumber",
    "owner",
    "parentAssetId",
    "expectedDelivery",
  ] as const)
    assert.equal(result[key], undefined);
  assert.deepEqual(result.levels, source.levels);
  assert.notEqual(result.levels, source.levels);
});
