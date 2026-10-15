import test from "node:test";
import assert from "node:assert/strict";
import {
  assetSchema,
  configSchema,
  type Commissioning,
} from "../src/lib/commissioning";
import {
  exportAssetCsv,
  exportRegisterJson,
  parseAssetCsv,
  parseRegisterFile,
} from "../src/lib/asset-transfer";
import {
  mergeRegister,
  registerImportSchema,
} from "../src/lib/commissioning-import";

const asset = assetSchema.parse({
  id: "AHU-001",
  name: 'AHU, "North"\nPlant',
  equipmentType: "Air handling unit",
  location: "Roof, east",
  levels: ["L2A", "L3"],
  clientSupplied: true,
  expectedDelivery: "2026-10-23",
  deliveryActivityId: "DEL-1",
  levelActivities: { L3: "TEST-1" },
});
const state: Commissioning = {
  version: 2,
  config: { levels: ["L2A", "L3"], priorities: ["P1"] },
  assets: [asset],
  schedule: [
    {
      activityId: "DEL-1",
      name: "Delivery",
      baselineStart: "2026-10-20",
      baselineFinish: "2026-10-21",
      start: "2026-10-21",
      finish: "2026-10-23",
    },
    {
      activityId: "TEST-1",
      name: "Test",
      start: "2026-10-24",
      finish: "2026-10-25",
      baselineStart: "2026-10-24",
      baselineFinish: "2026-10-25",
    },
  ],
  revisions: [],
};

test("asset CSV round trips quotes, newlines, mapping and explicit supply classification", () => {
  const imported = parseAssetCsv("\uFEFF" + exportAssetCsv([asset]));
  assert.deepEqual(imported.assets, [asset]);
  assert.deepEqual(imported.schedule, []);
  const repeated = mergeRegister(state, imported);
  assert.deepEqual(repeated.errors, []);
  assert.deepEqual(repeated.changes, []);
  assert.equal(repeated.assets.length, 1);
});

test("CSV never exports executable formula cells and reverses its apostrophe escaping", () => {
  for (const name of [
    "=SUM(A1)",
    "+cmd",
    "-formula",
    "@reference",
    "'literal",
    "\t=command",
  ]) {
    const row = { ...asset, name };
    const csv = exportAssetCsv([row]);
    assert(csv.includes(`"'${name}"`));
    assert.equal(parseAssetCsv(csv).assets[0].name, name.trim());
  }
});

test("CSV distinguishes unclassified, contractor and client supplied without coercion", () => {
  const rows = [
    { ...asset, id: "A", clientSupplied: true },
    { ...asset, id: "B", clientSupplied: false },
    { ...asset, id: "C", clientSupplied: undefined },
  ];
  assert.deepEqual(
    parseAssetCsv(exportAssetCsv(rows)).assets.map((a) => a.clientSupplied),
    [true, false, undefined],
  );
  assert.throws(
    () =>
      parseAssetCsv(
        "id,name,equipmentType,levels,clientSupplied\nA,AHU,AHU,L3,yes",
      ),
    /true, false or blank/,
  );
});

test("CSV missing optional columns preserves existing metadata and explicit blanks clear fields", () => {
  const result = parseAssetCsv(
    "id,name,equipmentType,levels\nAHU-001,New name,Air handling unit,L3",
    [asset],
  );
  assert.equal(result.assets[0].clientSupplied, true);
  assert.equal(result.assets[0].expectedDelivery, "2026-10-23");
  assert.deepEqual(result.assets[0].levelActivities, { L3: "TEST-1" });
  const cleared = parseAssetCsv(
    "id,name,equipmentType,levels,clientSupplied,expectedDelivery\nAHU-001,New name,Air handling unit,L3,,",
    [asset],
  );
  assert.equal(cleared.assets[0].clientSupplied, null);
  assert.equal(cleared.assets[0].expectedDelivery, undefined);
});

test("CSV rejects duplicate IDs, bad headers, mismatched rows and malformed quoting", () => {
  const header = "id,name,equipmentType,levels";
  assert.throws(
    () => parseAssetCsv(`${header}\nA,One,AHU,L3\nA,Two,AHU,L3`),
    /Duplicate asset IDs/,
  );
  assert.throws(
    () => parseAssetCsv("id,name,equipmentType\nA,One,AHU"),
    /Missing required CSV column: levels/,
  );
  assert.throws(
    () => parseAssetCsv(`${header},unknown\nA,One,AHU,L3,x`),
    /Unknown CSV column/,
  );
  assert.throws(
    () => parseAssetCsv(`${header},name\nA,One,AHU,L3,x`),
    /Duplicate CSV column/,
  );
  assert.throws(() => parseAssetCsv(`${header}\nA,One,AHU`), /cells; expected/);
  assert.throws(
    () => parseAssetCsv(`${header}\nA,"unclosed,AHU,L3`),
    /Unclosed/,
  );
  assert.throws(
    () => parseAssetCsv(`${header}\nA,"name"invalid,AHU,L3`),
    /Invalid CSV quoting/,
  );
  assert.throws(() => parseAssetCsv(`${header}\nA,One,AHU,L21`), /CSV row 2/);
  assert.throws(() => parseAssetCsv(`${header}\n`), /at least one asset/);
});

test("complete JSON register is importable and cannot overwrite an existing baseline", () => {
  const exported = exportRegisterJson(state);
  const input = parseRegisterFile("register.JSON", exported);
  assert.deepEqual(
    input,
    registerImportSchema.parse({
      assets: state.assets,
      schedule: state.schedule,
    }),
  );
  assert.deepEqual(mergeRegister(state, input).changes, []);
  input.schedule[0].baselineFinish = "2099-01-01";
  input.schedule[0].finish = "2026-10-29";
  const revised = mergeRegister(state, input);
  assert.equal(revised.schedule[0].baselineFinish, "2026-10-21");
  assert.equal(revised.schedule[0].finish, "2026-10-29");
  assert.equal(revised.assets.length, 1);
  assert.throws(
    () => parseRegisterFile("register.xlsx", ""),
    /Choose an exported/,
  );
});

test("optional project metadata preserves legacy config and validates canonical phase presentation", () => {
  assert.deepEqual(configSchema.parse(state.config), state.config);
  const config = {
    ...state.config,
    projectType: "Data centre",
    location: "Dublin",
    capacityMw: 24,
    phasePresentation: {
      L3: { label: "Functional testing", color: "#00aaBB" },
    },
  };
  assert.deepEqual(configSchema.parse(config), config);
  assert.equal(
    configSchema.safeParse({ ...config, capacityMw: -1 }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({
      ...config,
      phasePresentation: { L21: { label: "Invented", color: "#000000" } },
    }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({
      ...config,
      phasePresentation: { L3: { label: "Testing", color: "red" } },
    }).success,
    false,
  );
});

test("asset metadata survives older imports and can be explicitly cleared", () => {
  const recorded = {
    ...asset,
    discipline: "Mechanical",
    parentAssetId: "PARENT",
    owner: "Engineer",
    serialNumber: "AHU-SN-1",
  };
  const parent = { ...asset, id: "PARENT" };
  const prior = { ...state, assets: [recorded, parent] };
  const imported = { ...asset };
  delete imported.clientSupplied;
  const merged = mergeRegister(prior, { assets: [imported], schedule: [] });
  assert.deepEqual(merged.errors, []);
  assert.deepEqual(merged.changes, []);
  assert.deepEqual(merged.assets[0], recorded);
  const cleared = mergeRegister(prior, {
    assets: [
      {
        ...imported,
        clientSupplied: null,
        discipline: "",
        parentAssetId: "",
        owner: "",
        serialNumber: "",
      },
    ],
    schedule: [],
  });
  assert.deepEqual(cleared.errors, []);
  assert.equal(cleared.assets[0].parentAssetId, "");
  assert.equal(cleared.assets[0].clientSupplied, null);
  assert.equal(cleared.assets[0].serialNumber, "");
});

test("asset parents resolve regardless of import order and reject missing, self and cyclic references", () => {
  const row = { ...asset, parentAssetId: "PARENT" };
  const parent = { ...asset, id: "PARENT" };
  assert.deepEqual(
    mergeRegister(
      { ...state, assets: [] },
      { assets: [row, parent], schedule: [] },
    ).errors,
    [],
  );
  assert.match(
    mergeRegister(state, { assets: [row], schedule: [] }).errors.join(),
    /parent asset PARENT not found/,
  );
  assert.match(
    mergeRegister(state, {
      assets: [{ ...asset, parentAssetId: asset.id }],
      schedule: [],
    }).errors.join(),
    /cannot be its own parent/,
  );
  assert.match(
    mergeRegister(state, {
      assets: [row, { ...parent, parentAssetId: row.id }],
      schedule: [],
    }).errors.join(),
    /Asset parent cycle/,
  );
});

test("phase, floor and area round trip without inference and survive legacy imports", () => {
  const row = { ...asset, phase: "Phase 2", floor: "02", area: "East, A" };
  const prior = { ...state, assets: [row] };
  assert.deepEqual(parseAssetCsv(exportAssetCsv([row])).assets[0], row);
  assert.deepEqual(
    parseRegisterFile("register.json", exportRegisterJson(prior)).assets[0],
    row,
  );
  assert.deepEqual(
    mergeRegister(prior, { assets: [asset], schedule: [] }).assets[0],
    row,
  );
  const cleared = parseAssetCsv(
    "id,name,equipmentType,levels,phase,floor,area\nAHU-001,AHU,Air handling unit,L3,,,",
    [row],
  );
  const updated = mergeRegister(prior, cleared).assets[0];
  assert.equal(updated.phase, "");
  assert.equal(updated.floor, "");
  assert.equal(updated.area, "");
  const legacy = assetSchema.parse(asset);
  assert.equal(legacy.phase, undefined);
  assert.equal(legacy.floor, undefined);
  assert.equal(legacy.area, undefined);
});
