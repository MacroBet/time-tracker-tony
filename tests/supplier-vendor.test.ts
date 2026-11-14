import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { assetSchema, type Commissioning } from "../src/lib/commissioning";
import {
  exportAssetCsv,
  parseAssetCsv,
  parseAssetRows,
  exportRegisterJson,
} from "../src/lib/asset-transfer";
import {
  registerImportSchema,
  mergeRegister,
} from "../src/lib/commissioning-import";
import { exportAssetXlsxTemplate } from "../src/lib/asset-xlsx";
import { duplicateAssetDraft } from "../src/lib/asset-register-mutations";
const asset = assetSchema.parse({
  id: "A-1",
  name: "Pump",
  equipmentType: "Pump",
  location: "Roof",
  levels: ["L3"],
  vendor: 'Supplier, "North"',
  owner: "Different responsible person",
});
const state: Commissioning = {
  version: 1,
  config: { levels: ["L3"], priorities: ["P1"] },
  assets: [asset],
  schedule: [],
  revisions: [],
};
test("equipment supplier survives CSV and JSON independently of ownership", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(parseAssetCsv(exportAssetCsv([asset])).assets)),
    [asset],
  );
  assert.deepEqual(
    registerImportSchema.parse(JSON.parse(exportRegisterJson(state))).assets,
    [asset],
  );
  assert.equal(
    assetSchema.parse({
      id: "B",
      name: "B",
      equipmentType: "Pump",
      levels: [],
      owner: "Owner",
    }).vendor,
    undefined,
  );
});
test("older imports preserve supplier while an explicit empty supplier clears it", () => {
  const old = registerImportSchema.parse({
    assets: [
      {
        id: "A-1",
        name: "Updated",
        equipmentType: "Pump",
        location: "Roof",
        levels: ["L3"],
      },
    ],
  });
  assert.equal(mergeRegister(state, old).assets[0].vendor, asset.vendor);
  const clear = parseAssetRows(
    [
      ["id", "name", "equipmentType", "levels", "vendor"],
      ["A-1", "Pump", "Pump", "L3", ""],
    ],
    [asset],
  );
  assert.equal(mergeRegister(state, clear).assets[0].vendor, "");
});
test("supplier is available in the canonical Excel template and inventory clone", () => {
  const sheet = strFromU8(
    unzipSync(exportAssetXlsxTemplate())["xl/worksheets/sheet1.xml"],
  );
  assert(sheet.includes("vendor"));
  const clone = duplicateAssetDraft(asset);
  assert.equal(clone.vendor, asset.vendor);
  assert.equal(clone.owner, undefined);
  assert.equal(clone.id, "");
});
