import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../src/lib/demo-data";
import { scopeData } from "../src/lib/permissions";
import {
  assetSchema,
  commissioning,
  type Commissioning,
} from "../src/lib/commissioning";
import {
  mergeRegister,
  registerImportSchema,
} from "../src/lib/commissioning-import";
import {
  exportAssetCsv,
  exportRegisterJson,
  parseAssetCsv,
  parseRegisterFile,
} from "../src/lib/asset-transfer";
const now = new Date("2026-10-16T09:00:00.000Z");
const base = () =>
  structuredClone(commissioning(createDemoData(now).projects[0]));
const apply = (
  state: Commissioning,
  result: ReturnType<typeof mergeRegister>,
): Commissioning => ({
  ...state,
  assets: result.assets,
  schedule: result.schedule,
  programmeId: result.programmeId,
});
test("programme metadata-only imports trim, persist, clear explicitly and reimport idempotently", () => {
  const state = base(),
    snapshot = structuredClone(state);
  const input = registerImportSchema.parse({ programmeId: "  MASTER-2026  " });
  assert.deepEqual(input.assets, []);
  assert.deepEqual(input.schedule, []);
  const result = mergeRegister(state, input);
  assert.equal(result.programmeId, "MASTER-2026");
  assert.deepEqual(result.errors, []);
  assert.equal(result.changes.length, 1);
  assert(result.changes[0].includes("Programme ID"));
  assert.deepEqual(
    state,
    snapshot,
    "Previewing metadata does not mutate the source state.",
  );
  const saved = apply(state, result);
  assert.equal(mergeRegister(saved, input).changes.length, 0);
  const legacy = mergeRegister(
    saved,
    registerImportSchema.parse({ assets: [state.assets[0]] }),
  );
  assert.equal(
    legacy.programmeId,
    "MASTER-2026",
    "Old exports cannot erase the programme identifier.",
  );
  const cleared = mergeRegister(
    saved,
    registerImportSchema.parse({ programmeId: "   " }),
  );
  assert.equal(cleared.programmeId, "");
  assert.equal(cleared.changes.length, 1);
  assert.equal(
    mergeRegister(
      apply(saved, cleared),
      registerImportSchema.parse({ programmeId: "" }),
    ).changes.length,
    0,
  );
  assert(!registerImportSchema.safeParse({}).success);
  assert(
    !registerImportSchema.safeParse({ programmeId: "x".repeat(151) }).success,
  );
});
test("asset client and primary programme references are independent metadata without renaming IDs or baselines", () => {
  const state = base(),
    old = state.assets[0],
    activityId = state.schedule[0].activityId;
  const asset = assetSchema.parse({
    ...old,
    clientAssetId: " CLIENT-001 ",
    programmeActivityId: ` ${activityId} `,
  });
  const first = mergeRegister(
    state,
    registerImportSchema.parse({ programmeId: "MASTER-01", assets: [asset] }),
  );
  assert.deepEqual(first.errors, []);
  assert.equal(first.assets[0].id, old.id);
  assert.equal(first.assets[0].clientAssetId, "CLIENT-001");
  assert.equal(first.assets[0].programmeActivityId, activityId);
  assert.deepEqual(first.schedule, state.schedule);
  assert.deepEqual(first.assets[0].levelActivities, old.levelActivities);
  const saved = apply(state, first);
  assert.equal(
    mergeRegister(
      saved,
      registerImportSchema.parse({ programmeId: "MASTER-01", assets: [asset] }),
    ).changes.length,
    0,
  );
  const legacy = mergeRegister(
    saved,
    registerImportSchema.parse({ assets: [old] }),
  );
  assert.equal(legacy.assets[0].clientAssetId, "CLIENT-001");
  assert.equal(legacy.assets[0].programmeActivityId, activityId);
  const clear = mergeRegister(
    saved,
    registerImportSchema.parse({
      assets: [{ ...old, clientAssetId: "", programmeActivityId: "" }],
    }),
  );
  assert.equal(clear.assets[0].clientAssetId, "");
  assert.equal(clear.assets[0].programmeActivityId, "");
  assert(
    !assetSchema.safeParse({ ...old, clientAssetId: "a".repeat(151) }).success,
  );
  assert(
    !assetSchema.safeParse({ ...old, programmeActivityId: "a".repeat(151) })
      .success,
  );
});
test("primary programme activity resolves in the merged same-project programme, rejecting unknown or foreign-only references", () => {
  const state = base(),
    old = state.assets[0];
  const unknown = mergeRegister(
    state,
    registerImportSchema.parse({
      assets: [{ ...old, programmeActivityId: "FOREIGN-ONLY" }],
    }),
  );
  assert(
    unknown.errors.some((error) =>
      error.includes("primary programme Activity ID not found in this project"),
    ),
  );
  assert.equal(state.assets[0].programmeActivityId, undefined);
  const sameImport = mergeRegister(
    state,
    registerImportSchema.parse({
      assets: [{ ...old, programmeActivityId: "NEW-ACTIVITY" }],
      schedule: [
        {
          activityId: "NEW-ACTIVITY",
          name: "Primary commissioning test",
          finish: "2026-10-30",
        },
      ],
    }),
  );
  assert.deepEqual(sameImport.errors, []);
  assert.equal(sameImport.assets[0].programmeActivityId, "NEW-ACTIVITY");
  assert.deepEqual(
    sameImport.schedule.slice(0, state.schedule.length),
    state.schedule,
  );
});
test("CSV repeats project programme ID outside asset objects and round trips optional asset references safely", () => {
  const state = base();
  const assets = state.assets.slice(0, 2).map((asset, index) => ({
    ...asset,
    clientAssetId: `CLIENT-${index}`,
    programmeActivityId: state.schedule[0].activityId,
  }));
  const csv = exportAssetCsv(assets, "MASTER-CSV");
  const parsed = parseAssetCsv(csv);
  assert.equal(parsed.programmeId, "MASTER-CSV");
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.assets)), assets);
  assert(parsed.assets.every((asset) => !("programmeId" in asset)));
  assert.equal(parseAssetCsv(exportAssetCsv(assets)).programmeId, undefined);
  assert.equal(
    parseAssetCsv(csv.replaceAll('"MASTER-CSV"', '"  "')).programmeId,
    undefined,
    "Blank CSV programme metadata means preserve, unlike explicit JSON clear.",
  );
  const mixed = csv.replace('"MASTER-CSV"', '"OTHER-PROGRAMME"');
  assert.throws(() => parseAssetCsv(mixed), /more than one programme ID/);
  const escaped = parseAssetCsv(
    exportAssetCsv(
      [
        {
          ...assets[0],
          clientAssetId: "=untrusted-cell",
          programmeActivityId: "@activity",
        },
      ],
      "=PROGRAMME",
    ),
  );
  assert.equal(escaped.programmeId, "=PROGRAMME");
  assert.equal(escaped.assets[0].clientAssetId, "=untrusted-cell");
  assert.equal(escaped.assets[0].programmeActivityId, "@activity");
});
test("old CSV/JSON exports preserve new references and explicit blank asset cells clear them", () => {
  const state = base(),
    existing = {
      ...state.assets[0],
      clientAssetId: "CLIENT-01",
      programmeActivityId: state.schedule[0].activityId,
    };
  const legacyCsv = `id,name,equipmentType,levels\n${existing.id},${existing.name},${existing.equipmentType},${existing.levels.join(";")}`;
  const parsed = parseAssetCsv(legacyCsv, [existing]);
  assert.equal(parsed.assets[0].clientAssetId, existing.clientAssetId);
  assert.equal(
    parsed.assets[0].programmeActivityId,
    existing.programmeActivityId,
  );
  const cleared = parseAssetCsv(
    `${legacyCsv.split("\n")[0]},clientAssetId,programmeActivityId\n${legacyCsv.split("\n")[1]},,`,
    [existing],
  );
  assert.equal(cleared.assets[0].clientAssetId, "");
  assert.equal(cleared.assets[0].programmeActivityId, "");
  const full = { ...state, programmeId: "MASTER-JSON", assets: [existing] };
  assert.deepEqual(
    parseRegisterFile("register.json", exportRegisterJson(full)),
    {
      assets: [existing],
      schedule: state.schedule,
      programmeId: "MASTER-JSON",
    },
  );
  const legacy = parseRegisterFile(
    "old.json",
    JSON.stringify({ assets: [state.assets[0]], schedule: [] }),
  );
  assert.equal(legacy.programmeId, undefined);
  const merged = mergeRegister(full, legacy);
  assert.equal(merged.programmeId, "MASTER-JSON");
  assert.equal(merged.assets[0].clientAssetId, "CLIENT-01");
  assert.equal(
    merged.assets[0].programmeActivityId,
    existing.programmeActivityId,
  );
  assert.equal(
    JSON.parse(exportRegisterJson({ ...full, programmeId: "" })).programmeId,
    "",
  );
});

test("programme metadata-only changes never normalise existing legacy managed dates or baseline records", () => {
  const state = base();
  state.schedule.push({
    activityId: "LEGACY-MANAGED",
    name: "Legacy schedule record",
    start: "2026-10-17",
    finish: "2026-10-20",
    durationDays: 2,
  });
  const snapshot = structuredClone(state);
  const result = mergeRegister(
    state,
    registerImportSchema.parse({ programmeId: "METADATA-ONLY" }),
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.schedule, snapshot.schedule);
  assert.deepEqual(result.assets, snapshot.assets);
  assert.equal(result.changes.length, 1);
  assert.deepEqual(state, snapshot);
});
test("workers can read primary activities of already visible assets without leaking unrelated programme rows", () => {
  const data = createDemoData(now),
    state = data.projects[0].commissioning!;
  state.assets[0].programmeActivityId = "VISIBLE-PRIMARY";
  state.assets[1].programmeActivityId = "HIDDEN-PRIMARY";
  state.schedule.push(
    {
      activityId: "VISIBLE-PRIMARY",
      name: "Assigned asset primary task",
      finish: "2026-10-30",
    },
    {
      activityId: "HIDDEN-PRIMARY",
      name: "Other asset primary task",
      finish: "2026-10-30",
    },
    {
      activityId: "UNRELATED-ACTIVITY",
      name: "Private unrelated programme work",
      finish: "2026-10-30",
    },
  );
  const worker = data.users.find((user) => user.id === "u1")!;
  const scoped = scopeData(worker, data);
  const visible = scoped.projects[0].commissioning!.schedule.map(
    (activity) => activity.activityId,
  );
  assert(visible.includes("VISIBLE-PRIMARY"));
  assert(!visible.includes("HIDDEN-PRIMARY"));
  assert(!visible.includes("UNRELATED-ACTIVITY"));
});

test("asset-only reference edits preserve unrelated legacy programme dates and baselines", () => {
  const state = base();
  state.schedule.push({
    activityId: "LEGACY-MANAGED",
    name: "Legacy weekend plan",
    start: "2026-10-17",
    finish: "2026-10-20",
    durationDays: 2,
  });
  const snapshot = structuredClone(state.schedule);
  const result = mergeRegister(
    state,
    registerImportSchema.parse({
      assets: [
        {
          ...state.assets[0],
          clientAssetId: "CLIENT-METADATA",
          programmeActivityId: state.schedule[0].activityId,
        },
      ],
    }),
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.schedule, snapshot);
  assert.equal(result.changes.length, 1);
  assert.equal(result.assets[0].clientAssetId, "CLIENT-METADATA");
});
