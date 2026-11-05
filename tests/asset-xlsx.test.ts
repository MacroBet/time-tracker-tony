import test from "node:test";
import assert from "node:assert/strict";
import { strToU8, strFromU8, unzipSync, zipSync } from "fflate";
import {
  exportAssetXlsxTemplate,
  parseAssetXlsx,
  XLSX_LIMITS,
} from "../src/lib/asset-xlsx";
import { assetSchema } from "../src/lib/commissioning";
import { mergeRegister } from "../src/lib/commissioning-import";

const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function cells(values: string[], row: number) {
  return values
    .map(
      (v, i) =>
        `<c r="${String.fromCharCode(65 + i)}${row}" t="inlineStr"><is><t xml:space="preserve">${escape(v)}</t></is></c>`,
    )
    .join("");
}
const header = ["id", "name", "equipmentType", "levels"];
function workbook(
  rows: string[][] = [["0001", "Pump & north", "Pump", "L3"]],
  change: Record<string, string | Uint8Array> = {},
  headers = header,
) {
  const parts = unzipSync(exportAssetXlsxTemplate());
  parts["xl/worksheets/sheet1.xml"] = strToU8(
    `<worksheet xmlns="${ns}"><sheetData><row r="1">${cells(headers, 1)}</row>${rows.map((row, i) => `<row r="${i + 2}">${cells(row, i + 2)}</row>`).join("")}</sheetData></worksheet>`,
  );
  for (const [name, value] of Object.entries(change))
    parts[name] =
      typeof value === "string" ? strToU8(value) : new Uint8Array(value);
  return zipSync(parts);
}
function changedPart(name: string, replace: (text: string) => string) {
  return { [name]: replace(strFromU8(unzipSync(workbook())[name])) };
}

test("XLSX text and shared rich strings preserve IDs, literal formula-like text and omitted asset metadata", () => {
  const prior = assetSchema.parse({
    id: "0001",
    name: "Old pump",
    equipmentType: "Pump",
    location: "Roof",
    levels: ["L3"],
    expectedDelivery: "2026-11-09",
    deliveryActivityId: "A1",
    levelActivities: { L3: "A1" },
  });
  const bytes = workbook([["0001", '=literal, "north"\nÉast', "Pump", "L3"]]);
  const snapshot = bytes.slice();
  const input = parseAssetXlsx(bytes, [prior]);
  assert.deepEqual(input.assets, [
    { ...prior, name: '=literal, "north"\nÉast' },
  ]);
  assert.deepEqual(input.schedule, []);
  assert.deepEqual(bytes, snapshot);
  const state = {
    version: 1,
    config: { levels: ["L3"] as const, priorities: [] },
    assets: [prior],
    schedule: [
      {
        activityId: "A1",
        name: "Delivery",
        start: "2026-11-09",
        finish: "2026-11-09",
      },
    ],
    revisions: [],
  };
  const merged = mergeRegister(
    { ...state, config: { levels: ["L3"], priorities: [] } },
    input,
  );
  assert.deepEqual(merged.errors, []);
  assert.deepEqual(merged.schedule, state.schedule);
  assert.deepEqual(
    mergeRegister(
      {
        ...state,
        config: { levels: ["L3"], priorities: [] },
        assets: merged.assets,
      },
      parseAssetXlsx(bytes, merged.assets),
    ).changes,
    [],
  );
  const shared = workbook([], {
    ...changedPart("xl/_rels/workbook.xml.rels", (s) =>
      s.replace(
        "</Relationships>",
        '<Relationship Id="strings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
      ),
    ),
    "xl/sharedStrings.xml": `<sst xmlns="${ns}"><si><r><t>Pump</t></r><r><t xml:space="preserve"> &amp; shared</t></r></si></sst>`,
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${ns}"><sheetData><row r="1">${cells(header, 1)}</row><row r="2">${cells(["0001"], 2)}<c r="B2" t="s"><v>0</v></c>${cells(["Pump", "L3"], 2).replaceAll("A2", "C2").replaceAll("B2", "D2")}</row></sheetData></worksheet>`,
  });
  assert.equal(parseAssetXlsx(shared).assets[0].name, "Pump & shared");
});

test("XLSX explicit blanks clear fields, typed supply booleans and delivery dates use established semantics", () => {
  const headers = [
    ...header,
    "location",
    "clientSupplied",
    "expectedDelivery",
    "floor",
  ];
  const base = workbook(
    [["0001", "Pump", "Pump", "L3", "", "false", "2026-11-09", "02"]],
    {},
    headers,
  );
  const sheet = strFromU8(unzipSync(base)["xl/worksheets/sheet1.xml"]);
  const numericDate = sheet
    .replace(
      '<c r="F2" t="inlineStr"><is><t xml:space="preserve">false</t></is></c>',
      '<c r="F2" t="b"><v>0</v></c>',
    )
    .replace(
      '<c r="G2" t="inlineStr"><is><t xml:space="preserve">2026-11-09</t></is></c>',
      '<c r="G2" s="1"><v>46335</v></c>',
    );
  const styles = strFromU8(unzipSync(base)["xl/styles.xml"]).replace(
    '<cellXfs count="1">',
    '<cellXfs count="2"><xf numFmtId="14"/>',
  );
  const parts = unzipSync(base);
  parts["xl/worksheets/sheet1.xml"] = strToU8(
    numericDate.replace('s="1"', 's="0"'),
  );
  parts["xl/styles.xml"] = strToU8(styles);
  const saved = assetSchema.parse({
    id: "0001",
    name: "Pump",
    equipmentType: "Pump",
    levels: ["L3"],
    location: "Roof",
    clientSupplied: true,
  });
  const row = parseAssetXlsx(zipSync(parts), [saved]).assets[0];
  assert.equal(row.location, "");
  assert.equal(row.clientSupplied, false);
  assert.equal(row.floor, "02");
  assert.equal(row.expectedDelivery, "2026-11-09");
  const blank = parseAssetXlsx(
    workbook([["0001", "Pump", "Pump", "L3", "", "", "", "02"]], {}, headers),
    [saved],
  ).assets[0];
  assert.equal(blank.clientSupplied, null);
  assert.equal(blank.expectedDelivery, undefined);
});

test("XLSX rejects ambiguous sheets, formulas (including namespaced), external links, macros and DTDs", () => {
  const variants = [
    changedPart("xl/workbook.xml", (s) =>
      s.replace(
        "</sheets>",
        '<sheet name="Other" sheetId="2" r:id="rId3"/></sheets>',
      ),
    ),
    changedPart("xl/workbook.xml", (s) =>
      s.replace('sheetId="1"', 'sheetId="1" state="hidden"'),
    ),
    changedPart("xl/worksheets/sheet1.xml", (s) =>
      s.replace("<is>", "<f>1+1</f><is>"),
    ),
    changedPart("xl/worksheets/sheet1.xml", (s) =>
      s.replace("<is>", '<x:f xmlns:x="' + ns + '">1+1</x:f><is>'),
    ),
    changedPart("xl/_rels/workbook.xml.rels", (s) =>
      s.replace('Id="rId1"', 'Id="rId1" TargetMode="External"'),
    ),
    { "xl/vbaProject.bin": new Uint8Array([1, 2, 3]) },
    changedPart(
      "xl/workbook.xml",
      (s) =>
        '<!DOCTYPE workbook [<!ENTITY demo SYSTEM "https://example.invalid/private">]>' +
        s,
    ),
    changedPart("xl/worksheets/sheet1.xml", (s) =>
      s.replace(
        "</sheetData>",
        '</sheetData><mergeCells><mergeCell ref="A1:B1"/></mergeCells>',
      ),
    ),
  ];
  for (const variant of variants)
    assert.throws(() => parseAssetXlsx(workbook(undefined, variant)));
});

test("XLSX shares strict asset headers, schema and duplicate-ID checks without numeric ID coercion", () => {
  assert.throws(
    () =>
      parseAssetXlsx(
        workbook([
          ["0001", "Pump", "Pump", "L3"],
          ["0001", "Other", "Pump", "L3"],
        ]),
      ),
    /Duplicate asset IDs/,
  );
  assert.throws(
    () =>
      parseAssetXlsx(
        workbook(undefined, {}, ["id", "name", "equipmentType", "unknown"]),
      ),
    /Unknown XLSX column/,
  );
  assert.throws(
    () =>
      parseAssetXlsx(workbook(undefined, {}, ["id", "name", "name", "levels"])),
    /Duplicate XLSX column/,
  );
  assert.throws(
    () => parseAssetXlsx(workbook([["0001", "Pump", "Pump", "INVALID"]])),
    /XLSX row 2/,
  );
  const numeric = changedPart("xl/worksheets/sheet1.xml", (s) =>
    s.replace(/<c r="A2"[\s\S]*?<\/c>/, '<c r="A2"><v>1</v></c>'),
  );
  assert.throws(
    () => parseAssetXlsx(workbook(undefined, numeric)),
    /must contain text/,
  );
  const badIndex = changedPart("xl/worksheets/sheet1.xml", (s) =>
    s.replace(/<c r="A2"[\s\S]*?<\/c>/, '<c r="A2" t="s"><v>999</v></c>'),
  );
  assert.throws(
    () => parseAssetXlsx(workbook(undefined, badIndex)),
    /shared string/,
  );
});

test("XLSX bounds compressed/expanded size, row coordinates, columns, XML depth and archive completeness", () => {
  assert.throws(
    () => parseAssetXlsx(new Uint8Array(XLSX_LIMITS.fileBytes + 1)),
    /8 MB/,
  );
  assert.throws(
    () =>
      parseAssetXlsx(
        workbook(undefined, {
          "extra.xml": "x".repeat(XLSX_LIMITS.partBytes + 1),
        }),
      ),
    /expanded limit/,
  );
  assert.throws(
    () =>
      parseAssetXlsx(
        workbook(
          undefined,
          changedPart("xl/worksheets/sheet1.xml", (s) =>
            s.replaceAll('r="2"', 'r="10002"').replaceAll('2"', '10002"'),
          ),
        ),
      ),
    /10,001/,
  );
  assert.throws(
    () =>
      parseAssetXlsx(
        workbook(
          undefined,
          changedPart("xl/worksheets/sheet1.xml", (s) =>
            s.replace('r="D2"', 'r="T2"'),
          ),
        ),
      ),
    /19 columns/,
  );
  assert.throws(
    () =>
      parseAssetXlsx(
        workbook(undefined, {
          "extra.xml": "<a>".repeat(40) + "x" + "</a>".repeat(40),
        }),
      ),
    /nested|depth/i,
  );
  const bytes = workbook();
  assert.throws(
    () => parseAssetXlsx(bytes.subarray(0, bytes.length - 12)),
    /ZIP directory/,
  );
  assert.throws(
    () => parseAssetXlsx(workbook(undefined, { "extra.xml": "<broken>" })),
    /Invalid workbook XML/,
  );
});

test("blank Excel template has exactly canonical text headers and no project data", () => {
  const parts = unzipSync(exportAssetXlsxTemplate());
  const sheet = strFromU8(parts["xl/worksheets/sheet1.xml"]);
  assert.equal((sheet.match(/<row /g) || []).length, 1);
  assert.equal((sheet.match(/<c /g) || []).length, 19);
  assert(strFromU8(parts["xl/styles.xml"]).includes('numFmtId="49"'));
  assert.throws(
    () => parseAssetXlsx(exportAssetXlsxTemplate()),
    /at least one asset/,
  );
});

test("active workbook/string/style relationships determine data, never orphan parts", () => {
  const original = unzipSync(workbook());
  const sheet = strFromU8(original["xl/worksheets/sheet1.xml"]).replace(
    /<c r="A2"[\s\S]*?<\/c>/,
    '<c r="A2" t="s"><v>0</v></c>',
  );
  const relationships = strFromU8(
    original["xl/_rels/workbook.xml.rels"],
  ).replace(
    "</Relationships>",
    '<Relationship Id="strings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="strings-used.xml"/></Relationships>',
  );
  const bytes = workbook(undefined, {
    "xl/_rels/workbook.xml.rels": relationships,
    "xl/worksheets/sheet1.xml": sheet,
    "xl/strings-used.xml": `<sst xmlns="${ns}"><si><t>VISIBLE_ID_0001</t></si></sst>`,
    "xl/sharedStrings.xml": `<sst xmlns="${ns}"><si><t>ORPHAN_ID_9999</t></si></sst>`,
  });
  assert.equal(parseAssetXlsx(bytes).assets[0].id, "VISIBLE_ID_0001");
  const parts = unzipSync(bytes);
  parts["_rels/.rels"] = strToU8(
    strFromU8(parts["_rels/.rels"]).replace("xl/workbook.xml", "xl/active.xml"),
  );
  parts["xl/active.xml"] = parts["xl/workbook.xml"];
  parts["xl/_rels/active.xml.rels"] = parts["xl/_rels/workbook.xml.rels"];
  parts["xl/workbook.xml"] = strToU8(
    `<workbook xmlns="${ns}"><sheets/></workbook>`,
  );
  assert.equal(parseAssetXlsx(zipSync(parts)).assets[0].id, "VISIBLE_ID_0001");
  parts["xl/_rels/active.xml.rels"] = strToU8(
    relationships.replace('Target="styles.xml"', 'Target="missing-styles.xml"'),
  );
  assert.throws(() => parseAssetXlsx(zipSync(parts)), /styles part is missing/);
});

test("SpreadsheetML escaped underscores and UTF-16 units preserve the visible stable ID", () => {
  const prior = assetSchema.parse({
    id: "TAG_x0041_",
    name: "Old",
    equipmentType: "Pump",
    levels: ["L3"],
    location: "Roof",
  });
  const row = parseAssetXlsx(
    workbook([["TAG_x005F_x0041_", "Line_x000A_Pump", "Pump", "L3"]]),
    [prior],
  ).assets[0];
  assert.equal(row.id, prior.id);
  assert.equal(row.location, "Roof");
  assert.equal(row.name, "Line\nPump");
  assert.equal(
    parseAssetXlsx(workbook([["TAG_X0041_", "Pump", "Pump", "L3"]])).assets[0]
      .id,
    "TAG_X0041_",
  );
});

test("time-only Excel styles cannot masquerade as whole delivery dates", () => {
  const parts = unzipSync(
    workbook([["A", "Pump", "Pump", "L3", ""]], {}, [
      ...header,
      "expectedDelivery",
    ]),
  );
  const sheet = strFromU8(parts["xl/worksheets/sheet1.xml"]).replace(
    /<c r="E2"[\s\S]*?<\/c>/,
    '<c r="E2" s="0"><v>0</v></c>',
  );
  parts["xl/worksheets/sheet1.xml"] = strToU8(sheet);
  for (const numFmtId of [18, 19, 20, 21, 45, 46, 47]) {
    parts["xl/styles.xml"] = strToU8(
      `<styleSheet xmlns="${ns}"><cellXfs count="1"><xf numFmtId="${numFmtId}"/></cellXfs></styleSheet>`,
    );
    assert.throws(() => parseAssetXlsx(zipSync(parts)), /must contain text/);
  }
});

test("10,000-asset boundary is usable and actual expansion cannot bypass a forged ZIP size", () => {
  const rows = Array.from({ length: 10000 }, (_, i) => [
    `A${i}`,
    "Pump",
    "Pump",
    "L3",
  ]);
  assert.equal(parseAssetXlsx(workbook(rows)).assets.length, 10000);
  const bomb = workbook(undefined, {
    "large.xml": " ".repeat(XLSX_LIMITS.partBytes + 1),
  });
  const view = new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength);
  for (let i = 0; i < bomb.length - 30; i++) {
    if (
      view.getUint32(i, true) === 0x04034b50 &&
      strFromU8(
        bomb.subarray(i + 30, i + 30 + view.getUint16(i + 26, true)),
      ) === "large.xml"
    ) {
      view.setUint32(i + 22, 1, true);
      break;
    }
  }
  assert.throws(() => parseAssetXlsx(bomb), /archive|expanded limit/);
});

test("formatted empty numeric cells remain explicit blanks and external URI targets are rejected", () => {
  const base = workbook([["A", "Pump", "Pump", "L3", ""]], {}, [
    ...header,
    "expectedDelivery",
  ]);
  const parts = unzipSync(base);
  parts["xl/worksheets/sheet1.xml"] = strToU8(
    strFromU8(parts["xl/worksheets/sheet1.xml"]).replace(
      /<c r="E2"[\s\S]*?<\/c>/,
      '<c r="E2" s="0" t="n"/>',
    ),
  );
  assert.equal(
    parseAssetXlsx(zipSync(parts)).assets[0].expectedDelivery,
    undefined,
  );
  parts["xl/_rels/workbook.xml.rels"] = strToU8(
    strFromU8(parts["xl/_rels/workbook.xml.rels"]).replace(
      'Target="styles.xml"',
      'Target="https://example.invalid/style.xml"',
    ),
  );
  assert.throws(() => parseAssetXlsx(zipSync(parts)), /External links/);
});
