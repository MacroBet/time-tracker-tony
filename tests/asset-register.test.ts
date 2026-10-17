import test from "node:test";
import assert from "node:assert/strict";
import { type Asset } from "../src/lib/commissioning";
import {
  assetFieldOptions,
  filterAssetRegister,
} from "../src/lib/asset-register";

const asset = (id: string, fields: Partial<Asset> = {}): Asset => ({
  id,
  name: `Pump ${id}`,
  equipmentType: "Pump",
  location: "Roof",
  levels: [],
  ...fields,
});
const all = { query: "", supply: "all", area: "all", phase: "all" };
const rows = [
  asset("A", { area: "North", phase: "Phase 1", clientSupplied: true }),
  asset("B", { area: "North", phase: "Phase 2", clientSupplied: false }),
  asset("C", { area: "South", phase: "Phase 1", clientSupplied: true }),
  asset("D", { area: " ", phase: "" }),
  asset("E"),
];

test("area and phase combine with existing search and supply filters without changing records", () => {
  const before = structuredClone(rows);
  assert.deepEqual(
    filterAssetRegister(rows, {
      ...all,
      area: "value:North",
      phase: "value:Phase 1",
      supply: "true",
      query: "pump",
    }).map((a) => a.id),
    ["A"],
  );
  assert.equal(
    filterAssetRegister(rows, {
      ...all,
      area: "value:North",
      phase: "value:Phase 1",
      supply: "false",
    }).length,
    0,
  );
  assert.deepEqual(filterAssetRegister(rows, all), rows);
  assert.deepEqual(rows, before);
});

test("missing metadata includes blank, whitespace and absent values", () => {
  assert.deepEqual(
    filterAssetRegister(rows, {
      ...all,
      area: "missing",
      phase: "missing",
      supply: "unknown",
    }).map((a) => a.id),
    ["D", "E"],
  );
  assert.deepEqual(
    assetFieldOptions(rows, "area").map((o) => o.label),
    ["North", "South"],
  );
});

test("recorded values cannot collide with all/missing choices or imply multiphase membership", () => {
  const values = [
    "all",
    "missing",
    "value:North",
    "Phase 1",
    "phase 1",
    " Phase 1 ",
    "Phase 1, Phase 2",
  ];
  const assets = values.map((phase, index) => asset(String(index), { phase }));
  const options = assetFieldOptions(assets, "phase");
  assert.equal(options.length, 6);
  for (const { value, label } of options) {
    assert.deepEqual(
      filterAssetRegister(assets, { ...all, phase: value }).map((a) =>
        a.phase?.trim(),
      ),
      values.map((v) => v.trim()).filter((v) => v === label),
    );
  }
  assert.equal(
    filterAssetRegister(assets, { ...all, phase: "missing" }).length,
    0,
  );
});

test("search preserves external references, location metadata and project programme matching", () => {
  const assets = [
    asset("R", {
      clientAssetId: "CLIENT-44",
      programmeActivityId: "ACT-8",
      floor: "Level 4",
      owner: "Owner crew",
    }),
  ];
  for (const query of [" client-44 ", "act-8", "level 4", "OWNER", "PRG-1"]) {
    assert.equal(
      filterAssetRegister(assets, { ...all, query, programmeId: "PRG-1" })
        .length,
      1,
    );
  }
  assert.deepEqual(assetFieldOptions([], "area"), []);
  assert.deepEqual(filterAssetRegister([], all), []);
});
