import {
  sourceProgrammeSchema,
  type SourceProgramme,
} from "./programme-source";

/** Parse data only: no calendars, expressions, HTML or source scripts execute. */
export function parseP6XerText(
  text: string,
  source: SourceProgramme["source"],
): SourceProgramme {
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const header = lines[0];
  if (!header?.startsWith("ERMHDR\t"))
    throw new Error("Choose a Primavera XER export with an ERMHDR header.");
  const tables: SourceProgramme["tables"] = {};
  let current: SourceProgramme["tables"][string] | undefined;
  for (const [index, line] of lines.entries()) {
    if (index === 0 || !line || line === "%E") continue;
    const [marker, ...values] = line.split("\t");
    if (marker === "%T") {
      const name = values[0];
      if (!name || !/^[A-Z0-9_]+$/.test(name) || tables[name])
        throw new Error(
          `Invalid or repeated source table at line ${index + 1}.`,
        );
      current = { fields: [], rows: [], lines: [] };
      tables[name] = current;
    } else if (marker === "%F") {
      if (!current || current.fields.length)
        throw new Error(`Unexpected source columns at line ${index + 1}.`);
      current.fields = values;
    } else if (marker === "%R") {
      if (!current?.fields.length || values.length !== current.fields.length)
        throw new Error(`Source column mismatch at line ${index + 1}.`);
      current.rows.push(values);
      current.lines.push(index + 1);
    } else {
      throw new Error(`Unsupported XER record marker at line ${index + 1}.`);
    }
  }
  return sourceProgrammeSchema.parse({
    format: "p6-xer-v1",
    source: { ...source, header },
    tables,
  });
}

export async function parseP6Xer(
  bytes: Uint8Array,
  fileName: string,
): Promise<SourceProgramme> {
  if (bytes.byteLength > 64 * 1024 * 1024)
    throw new Error("The XER export exceeds the 64 MiB source limit.");
  let text: string;
  let encoding: SourceProgramme["source"]["encoding"] = "utf-8";
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    encoding = "windows-1252";
    text = new TextDecoder(encoding).decode(bytes);
  }
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  const sha256 = [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return parseP6XerText(text, { fileName, encoding, sha256, header: "" });
}
