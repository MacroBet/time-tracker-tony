import { Unzip, UnzipInflate, strToU8, zipSync } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ASSET_CSV_COLUMNS, parseAssetRows } from "./asset-transfer";
import type { Asset } from "./commissioning";

const MB = 1024 * 1024;
export const XLSX_LIMITS = {
  fileBytes: 8 * MB,
  expandedBytes: 32 * MB,
  partBytes: 16 * MB,
  parts: 256,
  rows: 10001,
  columns: ASSET_CSV_COLUMNS.length,
  xmlNodes: 600000,
} as const;
const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rels = "http://schemas.openxmlformats.org/package/2006/relationships";
const officeRels =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
type Node = Record<string, unknown>;
const nodes = (parent: Node | undefined, key: string): Node[] => {
  const value = parent?.[key];
  return (Array.isArray(value) ? value : [value]).filter(
    (v): v is Node => !!v && typeof v === "object" && !Array.isArray(v),
  );
};
const one = (parent: Node | undefined, key: string) => nodes(parent, key)[0];
const text = (node?: Node) => String(node?.["#text"] ?? "");
const attr = (node: Node, name: string) => String(node[`@${name}`] ?? "");
function fail(message: string): never {
  throw new Error(message);
}

/** Small compressed chunks bound actual expansion, not just ZIP size claims. */
function unpack(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length > XLSX_LIMITS.fileBytes) fail("Maximum file size is 8 MB.");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    fail("Choose a valid .xlsx workbook.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (
    let at = bytes.length - 22;
    at >= Math.max(0, bytes.length - 65557);
    at--
  ) {
    if (
      view.getUint32(at, true) === 0x06054b50 &&
      at + 22 + view.getUint16(at + 20, true) === bytes.length
    ) {
      end = at;
      break;
    }
  }
  if (
    end < 0 ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== view.getUint16(end + 10, true) ||
    view.getUint32(end + 12, true) + view.getUint32(end + 16, true) !== end
  )
    fail("Incomplete or unsupported XLSX ZIP directory.");
  const parts = new Map<string, Uint8Array>();
  const names = new Set<string>();
  let total = 0;
  const unzip = new Unzip((file) => {
    const name = file.name;
    if (
      name.length > 250 ||
      name.includes("\\") ||
      name.includes("\0") ||
      name.startsWith("/") ||
      name.split("/").some((part) => part === ".." || part === ".") ||
      names.has(name) ||
      names.size >= XLSX_LIMITS.parts
    )
      fail("Workbook has duplicate, unsafe or too many ZIP parts.");
    names.add(name);
    if (
      /vba|activex|macrosheet|dialogsheet|externalLinks|embeddings|connections\.xml/i.test(
        name,
      ) ||
      /\.bin$/i.test(name)
    )
      fail(
        "Macros, embedded objects and external connections are not supported. Use a plain asset workbook.",
      );
    if (
      file.originalSize !== undefined &&
      file.originalSize > XLSX_LIMITS.partBytes
    )
      fail("Workbook part exceeds the 16 MB expanded limit.");
    if (![0, 8].includes(file.compression))
      fail("Unsupported XLSX compression.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    file.ondata = (error, chunk, final) => {
      if (error) fail("Unable to read the XLSX archive.");
      size += chunk.length;
      total += chunk.length;
      if (size > XLSX_LIMITS.partBytes || total > XLSX_LIMITS.expandedBytes)
        fail(
          "Workbook exceeds the 16 MB per-part or 32 MB total expanded limit.",
        );
      if (chunk.length) chunks.push(chunk);
      if (final) {
        if (file.originalSize !== undefined && size !== file.originalSize)
          fail("Workbook part has an invalid size.");
        const content = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          content.set(chunk, offset);
          offset += chunk.length;
        }
        parts.set(name, content);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 4096)
    unzip.push(
      bytes.subarray(offset, offset + 4096),
      offset + 4096 >= bytes.length,
    );
  if (
    parts.size !== names.size ||
    parts.size !== view.getUint16(end + 10, true) ||
    !parts.has("[Content_Types].xml")
  )
    fail("Incomplete XLSX archive.");
  return parts;
}

function documents(parts: Map<string, Uint8Array>) {
  const result = new Map<string, Node>();
  let count = 0;
  for (const [name, content] of parts) {
    if (!/\.(xml|rels)$/i.test(name)) continue;
    let xml: string;
    try {
      xml = new TextDecoder("utf-8", { fatal: true }).decode(content);
    } catch {
      return fail("Workbook XML must use UTF-8.");
    }
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml))
      fail("XML declarations of entities or document types are not supported.");
    if (XMLValidator.validate(xml) !== true)
      fail(`Invalid workbook XML: ${name}.`);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: false,
      alwaysCreateTextNode: true,
      ignoreDeclaration: true,
      maxNestedTags: 32,
      processEntities: true,
      htmlEntities: false,
      updateTag(tag, _path, attributes) {
        if (++count > XLSX_LIMITS.xmlNodes)
          fail("Workbook contains too many XML nodes.");
        if (["f", "formula", "externalReference"].includes(tag))
          fail(
            "Formulas and external references are not supported. Paste values into the asset template first.",
          );
        if (
          Object.entries(attributes).some(
            ([key, value]) =>
              (key.endsWith("TargetMode") &&
                value.toLowerCase() === "external") ||
              (key.endsWith("Target") &&
                /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) ||
              (key.endsWith("ContentType") &&
                /macroenabled|vbaproject/i.test(value)),
          )
        )
          fail("External links and macro-enabled content are not supported.");
        return tag;
      },
    });
    result.set(name, parser.parse(xml) as Node);
  }
  return result;
}
function pathInPackage(target: string, directory: string): string {
  // A relationship is an archive path, never a URL, query or traversal.
  if (!target || /[:\\%?#]/.test(target))
    fail("Unsupported workbook relationship target.");
  const path = target.startsWith("/")
    ? target.slice(1)
    : `${directory}${target}`;
  if (path.split("/").some((part) => !part || part === ".." || part === "."))
    fail("Unsafe workbook relationship target.");
  return path;
}
// SpreadsheetML escapes UTF-16 code units; decode once so escaped underscores
// such as _x005F_x0041_ remain the literal text _x0041_.
const spreadsheetText = (value: string) =>
  value.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
function richText(node?: Node): string {
  const value = node
    ? text(one(node, "t")) +
      nodes(node, "r")
        .map((run) => text(one(run, "t")))
        .join("")
    : "";
  if (value.length > 32767) fail("Maximum 32,767 characters per cell.");
  return spreadsheetText(value);
}
function dateFromSerial(value: string, date1904: boolean): string {
  const serial = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(serial) ||
    (!date1904 && serial === 60)
  )
    fail(
      "Delivery dates must be whole dates. Use YYYY-MM-DD text, without a time.",
    );
  const day = date1904 ? serial : serial - (serial > 60 ? 1 : 0);
  const result = new Date(
    Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31) +
      day * 86400000,
  );
  if (!Number.isFinite(result.valueOf()) || result.getUTCFullYear() > 9999)
    fail("Invalid Excel delivery date.");
  return result.toISOString().slice(0, 10);
}

export function parseAssetXlsx(
  bytes: Uint8Array,
  existingAssets: Asset[] = [],
) {
  const docs = documents(unpack(bytes));
  const packageRelations = nodes(
    one(docs.get("_rels/.rels"), "Relationships"),
    "Relationship",
  );
  const officeDocuments = packageRelations.filter((item) =>
    attr(item, "Type").endsWith("/officeDocument"),
  );
  if (officeDocuments.length !== 1)
    fail("Workbook relationship is missing or ambiguous.");
  const workbookPath = pathInPackage(attr(officeDocuments[0], "Target"), "");
  const directory = workbookPath.slice(0, workbookPath.lastIndexOf("/") + 1);
  const workbook = one(docs.get(workbookPath), "workbook");
  const sheets = nodes(one(workbook, "sheets"), "sheet");
  if (
    sheets.length !== 1 ||
    attr(sheets[0], "state") === "hidden" ||
    attr(sheets[0], "state") === "veryHidden"
  )
    fail(
      "Use one visible asset worksheet per workbook. Copy the desired sheet to a separate .xlsx file.",
    );
  const relations = nodes(
    one(
      docs.get(
        `${directory}_rels/${workbookPath.slice(directory.length)}.rels`,
      ),
      "Relationships",
    ),
    "Relationship",
  );
  const relation = relations.filter(
    (item) => attr(item, "Id") === attr(sheets[0], "id"),
  );
  if (
    relation.length !== 1 ||
    !attr(relation[0], "Type").endsWith("/worksheet")
  )
    fail("Workbook worksheet relationship is missing or invalid.");
  const worksheet = one(
    docs.get(pathInPackage(attr(relation[0], "Target"), directory)),
    "worksheet",
  );
  if (!worksheet || nodes(one(worksheet, "mergeCells"), "mergeCell").length)
    fail("Use an asset table without merged cells.");
  const relatedPart = (type: string) => {
    const matches = relations.filter((item) =>
      attr(item, "Type").endsWith(`/${type}`),
    );
    if (matches.length > 1)
      fail(`Workbook has ambiguous ${type} relationships.`);
    if (!matches.length) return undefined;
    const part = docs.get(pathInPackage(attr(matches[0], "Target"), directory));
    if (!part) fail(`Workbook ${type} part is missing.`);
    return part;
  };
  const shared = nodes(one(relatedPart("sharedStrings"), "sst"), "si").map(
    richText,
  );
  const styles = one(relatedPart("styles"), "styleSheet");
  const dateFormats = new Set([14, 15, 16, 17, 22]);
  for (const format of nodes(one(styles, "numFmts"), "numFmt")) {
    const code = attr(format, "formatCode").replace(
      /"[^"]*"|\\.|\[[^\]]*\]/g,
      "",
    );
    if (/[yd]/i.test(code)) dateFormats.add(Number(attr(format, "numFmtId")));
  }
  const dateStyles = nodes(one(styles, "cellXfs"), "xf").map((style) =>
    dateFormats.has(Number(attr(style, "numFmtId"))),
  );
  const date1904 = ["1", "true"].includes(
    attr(one(workbook, "workbookPr") ?? {}, "date1904"),
  );
  const table: string[][] = [];
  const sourceRows: number[] = [];
  let previousRow = 0;
  let width = 0;
  for (const row of nodes(one(worksheet, "sheetData"), "row")) {
    const rowNumber = attr(row, "r") ? Number(attr(row, "r")) : previousRow + 1;
    if (
      !Number.isInteger(rowNumber) ||
      rowNumber <= previousRow ||
      rowNumber > XLSX_LIMITS.rows
    )
      fail(
        "Use ordered rows within the first 10,001 worksheet rows (header plus up to 10,000 assets).",
      );
    previousRow = rowNumber;
    const values: string[] = [];
    const seen = new Set<number>();
    let nextColumn = 0;
    for (const cell of nodes(row, "c")) {
      const ref = attr(cell, "r");
      const match = ref.match(/^([A-Z]+)([1-9]\d*)$/);
      if (ref && (!match || Number(match[2]) !== rowNumber))
        fail("Invalid worksheet cell reference.");
      const column = match
        ? [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1
        : nextColumn;
      if (column >= XLSX_LIMITS.columns || seen.has(column))
        fail("Maximum 19 columns; duplicate cells are not supported.");
      seen.add(column);
      nextColumn = column + 1;
      const type = attr(cell, "t");
      const raw = text(one(cell, "v"));
      const header = table[0]?.[column]?.trim();
      let value = "";
      if (type === "inlineStr") value = richText(one(cell, "is"));
      else if (type === "s") {
        if (!/^\d+$/.test(raw) || shared[Number(raw)] === undefined)
          fail(`Invalid shared string at ${ref || rowNumber}.`);
        value = shared[Number(raw)];
      } else if (type === "str") value = spreadsheetText(raw);
      else if (
        type === "b" &&
        header === "clientSupplied" &&
        ["0", "1"].includes(raw)
      )
        value = raw === "1" ? "true" : "false";
      else if (
        type === "d" &&
        header === "expectedDelivery" &&
        /^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.0+)?Z?)?$/.test(raw)
      )
        value = raw.slice(0, 10);
      else if (!raw && (!type || type === "n")) value = "";
      else if (
        (!type || type === "n") &&
        header === "expectedDelivery" &&
        dateStyles[Number(attr(cell, "s"))]
      )
        value = dateFromSerial(raw, date1904);
      else
        fail(
          `Cell ${ref || `in row ${rowNumber}`} must contain text${header === "clientSupplied" ? " or TRUE/FALSE" : ""}. Use the blank Excel template; delivery dates may also be Excel date cells.`,
        );
      if (value.length > 32767) fail("Maximum 32,767 characters per cell.");
      values[column] = value;
    }
    if (!values.some((v) => v?.trim())) continue;
    if (!table.length) {
      if (rowNumber !== 1)
        fail("The asset column headers must be in the first worksheet row.");
      width = values.length;
    } else if (values.slice(width).some((v) => v?.trim()))
      fail(`XLSX row ${rowNumber} has data outside the header columns.`);
    table.push(Array.from({ length: width }, (_, i) => values[i] ?? ""));
    sourceRows.push(rowNumber);
  }
  try {
    return parseAssetRows(table, existingAssets);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    throw new Error(
      error.message
        .replace(
          /CSV row (\d+)/g,
          (_, row) => `XLSX row ${sourceRows[Number(row) - 1] ?? row}`,
        )
        .replaceAll("CSV", "XLSX"),
    );
  }
}

/** Blank, text-formatted workbook: no project data or formulas. */
export function exportAssetXlsxTemplate(): Uint8Array<ArrayBuffer> {
  const xml = (body: string) =>
    strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`);
  return zipSync(
    {
      "[Content_Types].xml": xml(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      ),
      "_rels/.rels": xml(
        `<Relationships xmlns="${rels}"><Relationship Id="rId1" Type="${officeRels}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
      "xl/workbook.xml": xml(
        `<workbook xmlns="${main}" xmlns:r="${officeRels}"><sheets><sheet name="Assets" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
      "xl/_rels/workbook.xml.rels": xml(
        `<Relationships xmlns="${rels}"><Relationship Id="rId1" Type="${officeRels}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${officeRels}/styles" Target="styles.xml"/></Relationships>`,
      ),
      "xl/styles.xml": xml(
        `<styleSheet xmlns="${main}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
      ),
      "xl/worksheets/sheet1.xml": xml(
        `<worksheet xmlns="${main}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="19" width="24" customWidth="1" style="0"/></cols><sheetData><row r="1">${ASSET_CSV_COLUMNS.map((name, i) => `<c r="${String.fromCharCode(65 + i)}1" t="inlineStr"><is><t>${name}</t></is></c>`).join("")}</row></sheetData></worksheet>`,
      ),
    },
    { level: 6 },
  );
}
