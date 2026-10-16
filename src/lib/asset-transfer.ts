import { assetSchema, type Asset, type Commissioning } from "./commissioning";
import {
  registerImportSchema,
  type RegisterImport,
} from "./commissioning-import";

export const ASSET_CSV_COLUMNS = [
  "id",
  "name",
  "equipmentType",
  "location",
  "phase",
  "floor",
  "area",
  "discipline",
  "parentAssetId",
  "serialNumber",
  "owner",
  "clientSupplied",
  "levels",
  "deliveryActivityId",
  "expectedDelivery",
  "levelActivities",
  "programmeId",
  "clientAssetId",
  "programmeActivityId",
] as const;

// Excel interprets leading formula characters even in quoted cells. Prefix them
// (and existing apostrophes) reversibly so downloaded registers remain data.
const formulaLike = /^(?:\s*[=+\-@]|['\t\r\n])/;
function encodeCell(value: string): string {
  const safe = formulaLike.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
function decodeCell(value: string): string {
  return value.startsWith("'") && formulaLike.test(value.slice(1))
    ? value.slice(1)
    : value;
}

export function exportAssetCsv(assets: Asset[], programmeId?: string): string {
  return [
    ASSET_CSV_COLUMNS.join(","),
    ...assets.map((asset) =>
      ASSET_CSV_COLUMNS.map((column) => {
        const value = column === "programmeId" ? programmeId : asset[column];
        return encodeCell(
          column === "levels"
            ? asset.levels.join(";")
            : column === "levelActivities"
              ? value
                ? JSON.stringify(value)
                : ""
              : value === undefined || value === null
                ? ""
                : String(value),
        );
      }).join(","),
    ),
  ].join("\r\n");
}

export function exportRegisterJson(
  state: Pick<Commissioning, "assets" | "schedule" | "programmeId">,
): string {
  return JSON.stringify(
    {
      assets: state.assets,
      schedule: state.schedule,
      programmeId: state.programmeId,
    },
    null,
    2,
  );
}

function csvRows(text: string): string[][] {
  if (text.length > 8 * 1024 * 1024)
    throw new Error("Maximum file size is 8 MB.");
  const input = text.replace(/^\uFEFF/, ""),
    rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closedQuote = false;
  function endCell() {
    row.push(decodeCell(cell));
    if (row.length > ASSET_CSV_COLUMNS.length)
      throw new Error(
        "Too many CSV columns. Use the asset CSV export as a template.",
      );
    cell = "";
    closedQuote = false;
  }
  function endRow() {
    endCell();
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
    if (rows.length > 10001)
      throw new Error("Maximum 10,000 assets per import.");
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else cell += char;
    } else if (char === ",") endCell();
    else if (char === "\r" || char === "\n") {
      endRow();
      if (char === "\r" && input[i + 1] === "\n") i++;
    } else if (char === '"' && cell === "" && !closedQuote) quoted = true;
    else {
      if (closedQuote || char === '"')
        throw new Error(`Invalid CSV quoting near row ${rows.length + 1}.`);
      cell += char;
    }
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  if (cell || row.length || closedQuote) endRow();
  return rows;
}

/** Missing optional columns preserve existing fields; an explicitly blank cell clears them. */
export function parseAssetCsv(
  text: string,
  existingAssets: Asset[] = [],
): RegisterImport {
  const [rawHeaders, ...rows] = csvRows(text);
  if (!rawHeaders || !rows.length)
    throw new Error("CSV needs a header and at least one asset.");
  const headers = rawHeaders.map((h) => h.trim());
  if (new Set(headers).size !== headers.length)
    throw new Error("Duplicate CSV column names.");
  for (const header of headers)
    if (!(ASSET_CSV_COLUMNS as readonly string[]).includes(header))
      throw new Error(
        `Unknown CSV column: ${header}. Use the exported CSV format.`,
      );
  for (const required of ["id", "name", "equipmentType", "levels"])
    if (!headers.includes(required))
      throw new Error(`Missing required CSV column: ${required}.`);
  const existing = new Map(existingAssets.map((a) => [a.id, a]));
  const programmeIds = new Set<string>();
  const assets = rows.map((row, index) => {
    if (row.length !== headers.length)
      throw new Error(
        `CSV row ${index + 2} has ${row.length} cells; expected ${headers.length}.`,
      );
    const fields = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    const id = fields.id.trim();
    const { programmeId, ...assetFields } = fields;
    if (programmeId?.trim()) programmeIds.add(programmeId.trim());
    if (programmeIds.size > 1)
      throw new Error(
        "CSV contains more than one programme ID. A project currently has one programme; import one programme at a time.",
      );
    const asset: Record<string, unknown> = {
      ...existing.get(id),
      ...assetFields,
      id,
    };
    asset.levels = fields.levels
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const optional of [
      "clientAssetId",
      "programmeActivityId",
      "discipline",
      "parentAssetId",
      "serialNumber",
      "owner",
      "phase",
      "floor",
      "area",
    ] as const) {
      if (
        optional in fields &&
        !fields[optional].trim() &&
        existing.get(id)?.[optional] === undefined
      )
        delete asset[optional];
    }
    for (const optional of ["deliveryActivityId", "expectedDelivery"])
      if (optional in fields)
        asset[optional] = fields[optional].trim() || undefined;
    if ("clientSupplied" in fields) {
      const value = fields.clientSupplied.trim().toLowerCase();
      if (value && value !== "true" && value !== "false")
        throw new Error(
          `CSV row ${index + 2}: clientSupplied must be true, false or blank (unclassified).`,
        );
      asset.clientSupplied =
        value === ""
          ? existing.get(id)?.clientSupplied === undefined
            ? undefined
            : null
          : value === "true";
    }
    if ("levelActivities" in fields) {
      try {
        asset.levelActivities = fields.levelActivities.trim()
          ? JSON.parse(fields.levelActivities)
          : undefined;
      } catch {
        throw new Error(
          `CSV row ${index + 2}: levelActivities must be a JSON object.`,
        );
      }
    }
    const result = assetSchema.safeParse(asset);
    if (!result.success)
      throw new Error(
        `CSV row ${index + 2}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      );
    return result.data;
  });
  if (new Set(assets.map((asset) => asset.id)).size !== assets.length)
    throw new Error(
      "Duplicate asset IDs in CSV. Each asset tag must be unique.",
    );
  return registerImportSchema.parse({
    assets,
    schedule: [],
    ...(programmeIds.size ? { programmeId: [...programmeIds][0] } : {}),
  });
}

export function parseRegisterFile(
  name: string,
  text: string,
  existingAssets: Asset[] = [],
): RegisterImport {
  if (name.toLowerCase().endsWith(".csv"))
    return parseAssetCsv(text, existingAssets);
  if (name.toLowerCase().endsWith(".json"))
    return registerImportSchema.parse(JSON.parse(text));
  throw new Error("Choose an exported .csv or .json register.");
}
