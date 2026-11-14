/** A deliberately small Markdown AST. Raw HTML never enters the render tree. */
export type AssistantInline =
  | { type: "text" | "code"; text: string }
  | { type: "strong" | "em"; children: AssistantInline[] }
  | { type: "link"; href: string; children: AssistantInline[] }
  | { type: "break" };
export type AssistantBlock =
  | { type: "paragraph"; children: AssistantInline[] }
  | { type: "heading"; level: number; children: AssistantInline[] }
  | { type: "code"; text: string; language: string }
  | { type: "quote"; children: AssistantBlock[] }
  | { type: "list"; ordered: boolean; start: number; items: AssistantBlock[][] }
  | { type: "rule" }
  | {
      type: "table";
      header: AssistantInline[][];
      rows: AssistantInline[][][];
      align: ("left" | "center" | "right")[];
    };

/** Browser URL parsing is authoritative; schemes and control characters are denied. */
export function safeAssistantHref(raw: string): string | undefined {
  const value = raw.trim();
  if (!value || /[\u0000-\u0020\u007f-\u009f\\]/u.test(value)) return;
  try {
    const url = new URL(value, "https://fieldtrack.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    return value;
  } catch {
    return;
  }
}

function append(nodes: AssistantInline[], text: string) {
  if (!text) return;
  const last = nodes.at(-1);
  if (last?.type === "text") last.text += text;
  else nodes.push({ type: "text", text });
}
function runLength(text: string, start: number) {
  let end = start + 1;
  while (text[end] === text[start]) end++;
  return end - start;
}
function closingDelimiter(
  text: string,
  start: number,
  marker: string,
  size: number,
) {
  for (let index = start; index < text.length; index++) {
    if (text[index] === "\\") {
      index++;
      continue;
    }
    if (text[index] !== marker) continue;
    const count = runLength(text, index);
    const end = index + count;
    const before = text[index - 1] ?? "";
    const after = text[end] ?? "";
    if (
      count >= size &&
      before &&
      !/\s/u.test(before) &&
      !(marker === "_" && /[\p{L}\p{N}]/u.test(after))
    )
      return end - size;
    index = end - 1;
  }
  return -1;
}
function linkAt(text: string, start: number) {
  let depth = 1;
  let index = start + 1;
  for (; index < text.length; index++) {
    if (text[index] === "\\") {
      index++;
      continue;
    }
    if (text[index] === "[") depth++;
    if (text[index] === "]" && --depth === 0) break;
    // Only closing brackets affect depth.
    if (text[index] !== "]") continue;
  }
  if (depth !== 0 || text[index + 1] !== "(") return;
  const label = text.slice(start + 1, index);
  let cursor = index + 2;
  while (text[cursor] === " " || text[cursor] === "\t") cursor++;
  let href = "";
  if (text[cursor] === "<") {
    const end = text.indexOf(">", cursor + 1);
    if (end < 0) return;
    href = text.slice(cursor + 1, end);
    cursor = end + 1;
  } else {
    const begin = cursor;
    let parentheses = 0;
    for (; cursor < text.length; cursor++) {
      const character = text[cursor];
      if (character === "\\") {
        cursor++;
        continue;
      }
      if (character === "(") parentheses++;
      else if (character === ")") {
        if (!parentheses) break;
        parentheses--;
      } else if (/\s/u.test(character) && !parentheses) break;
    }
    href = text.slice(begin, cursor);
  }
  while (/\s/u.test(text[cursor] ?? "") && cursor < text.length) cursor++;
  if (text[cursor] === '"' || text[cursor] === "'") {
    const quote = text[cursor++];
    while (cursor < text.length && text[cursor] !== quote) {
      if (text[cursor] === "\\") cursor++;
      cursor++;
    }
    if (text[cursor] !== quote) return;
    cursor++;
    while (/\s/u.test(text[cursor] ?? "") && cursor < text.length) cursor++;
  }
  if (text[cursor] !== ")") return;
  return {
    label,
    href: href.replace(/\\([\\()[\]<>])/gu, "$1"),
    end: cursor + 1,
  };
}

export function parseAssistantInline(
  text: string,
  depth = 0,
  allowLinks = true,
): AssistantInline[] {
  if (depth > 16) return [{ type: "text", text }];
  const nodes: AssistantInline[] = [];
  for (let index = 0; index < text.length;) {
    const character = text[index];
    if (
      character === "\\" &&
      /[\\`*{}[\]()#+.!_>|~-]/u.test(text[index + 1] ?? "")
    ) {
      append(nodes, text[index + 1]);
      index += 2;
      continue;
    }
    if (character === "\\" && text[index + 1] === "\n") {
      nodes.push({ type: "break" });
      index += 2;
      continue;
    }
    if (character === "\n" && text.slice(0, index).endsWith("  ")) {
      const last = nodes.at(-1);
      if (last?.type === "text") last.text = last.text.replace(/ +$/u, "");
      nodes.push({ type: "break" });
      index++;
      continue;
    }
    if (character === "`") {
      const size = runLength(text, index);
      let end = index + size;
      while ((end = text.indexOf("`".repeat(size), end)) >= 0) {
        if (text[end - 1] !== "`" && text[end + size] !== "`") break;
        end += size;
      }
      if (end >= 0) {
        let code = text.slice(index + size, end).replace(/\n/gu, " ");
        if (code.startsWith(" ") && code.endsWith(" ") && /\S/u.test(code))
          code = code.slice(1, -1);
        nodes.push({ type: "code", text: code });
        index = end + size;
        continue;
      }
      append(nodes, "`".repeat(size));
      index += size;
      continue;
    }
    if (character === "!" && text[index + 1] === "[") {
      const image = linkAt(text, index + 1);
      if (image) {
        append(nodes, text.slice(index, image.end));
        index = image.end;
        continue;
      }
    }
    if (allowLinks && character === "[") {
      const link = linkAt(text, index);
      if (link) {
        const href = safeAssistantHref(link.href);
        const children = parseAssistantInline(link.label, depth + 1, false);
        if (href) nodes.push({ type: "link", href, children });
        else nodes.push(...children);
        index = link.end;
        continue;
      }
    }
    if (allowLinks && character === "<") {
      const end = text.indexOf(">", index + 1);
      const candidate = text.slice(index + 1, end);
      if (
        end >= 0 &&
        /^https?:\/\//iu.test(candidate) &&
        safeAssistantHref(candidate)
      ) {
        nodes.push({
          type: "link",
          href: candidate,
          children: [{ type: "text", text: candidate }],
        });
        index = end + 1;
        continue;
      }
    }
    if (
      (character === "*" || character === "_") &&
      !/\s/u.test(text[index + 1] ?? " ") &&
      !(character === "_" && /[\p{L}\p{N}]/u.test(text[index - 1] ?? ""))
    ) {
      const count = runLength(text, index);
      const size = Math.min(count, 3);
      const end = closingDelimiter(text, index + size, character, size);
      if (end > index + size) {
        const children = parseAssistantInline(
          text.slice(index + size, end),
          depth + 1,
          allowLinks,
        );
        nodes.push(
          size === 3
            ? { type: "strong", children: [{ type: "em", children }] }
            : { type: size === 2 ? "strong" : "em", children },
        );
        index = end + size;
        continue;
      }
      append(nodes, character.repeat(count));
      index += count;
      continue;
    }
    append(nodes, character);
    index++;
  }
  return nodes;
}

function tableCells(line: string): string[] {
  const value = line.trim();
  const cells: string[] = [];
  let cell = "",
    codeSize = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "\\" && index + 1 < value.length) {
      cell += character + value[++index];
      continue;
    }
    if (character === "`") {
      const size = runLength(value, index);
      if (!codeSize) codeSize = size;
      else if (codeSize === size) codeSize = 0;
      cell += "`".repeat(size);
      index += size - 1;
      continue;
    }
    if (character === "|" && !codeSize) {
      cells.push(cell.trim());
      cell = "";
    } else cell += character;
  }
  cells.push(cell.trim());
  if (value.startsWith("|")) cells.shift();
  if (value.endsWith("|") && cells.at(-1) === "") cells.pop();
  return cells;
}
const listMarker = (line: string) =>
  /^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+)(.*)$/u.exec(line);
const fenceMarker = (line: string) =>
  /^ {0,3}(`{3,}|~{3,})([^`]*)$/u.exec(line);
const headingMarker = (line: string) =>
  /^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/u.exec(line);
const rule = (line: string) =>
  /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/u.test(line);
const blockStart = (line: string) =>
  !!(
    listMarker(line) ||
    fenceMarker(line) ||
    headingMarker(line) ||
    /^ {0,3}>/u.test(line) ||
    rule(line)
  );

export function parseAssistantMarkdown(
  text: string,
  depth = 0,
): AssistantBlock[] {
  if (depth > 16)
    return [{ type: "paragraph", children: [{ type: "text", text }] }];
  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  const blocks: AssistantBlock[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }
    const fence = fenceMarker(line);
    if (fence) {
      const size = fence[1].length,
        marker = fence[1][0],
        content: string[] = [];
      index++;
      while (
        index < lines.length &&
        !new RegExp(`^ {0,3}${marker}{${size},}\\s*$`, "u").test(lines[index])
      )
        content.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push({
        type: "code",
        text: content.join("\n"),
        language: fence[2].trim().split(/\s/u)[0] ?? "",
      });
      continue;
    }
    const heading = headingMarker(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        children: parseAssistantInline(
          (heading[2] ?? "").replace(/[ \t]+#+[ \t]*$/u, ""),
        ),
      });
      index++;
      continue;
    }
    if (rule(line)) {
      blocks.push({ type: "rule" });
      index++;
      continue;
    }
    if (/^ {0,3}>/u.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^ {0,3}>/u.test(lines[index]))
        quoted.push(lines[index++].replace(/^ {0,3}> ?/u, ""));
      blocks.push({
        type: "quote",
        children: parseAssistantMarkdown(quoted.join("\n"), depth + 1),
      });
      continue;
    }
    const list = listMarker(line);
    if (list) {
      const ordered = /^\d/u.test(list[2]),
        indent = list[1].length,
        items: AssistantBlock[][] = [];
      while (index < lines.length) {
        const item = listMarker(lines[index]);
        if (
          !item ||
          item[1].length !== indent ||
          /^\d/u.test(item[2]) !== ordered
        )
          break;
        const content = [item[4]],
          contentIndent = item[1].length + item[2].length + item[3].length;
        index++;
        while (index < lines.length) {
          const next = lines[index],
            marker = listMarker(next);
          if (marker && marker[1].length <= indent) break;
          if (!next.trim()) {
            content.push("");
            index++;
            if (
              index >= lines.length ||
              (lines[index].search(/\S/u) <= indent &&
                !listMarker(lines[index]))
            )
              break;
            continue;
          }
          if (next.search(/\S/u) >= contentIndent) {
            content.push(next.slice(contentIndent));
            index++;
            continue;
          }
          if (blockStart(next) || content.at(-1) === "") break;
          content.push(next);
          index++;
        }
        items.push(parseAssistantMarkdown(content.join("\n"), depth + 1));
      }
      blocks.push({
        type: "list",
        ordered,
        start: ordered ? Number.parseInt(list[2], 10) : 1,
        items,
      });
      continue;
    }
    const separator =
      index + 1 < lines.length ? tableCells(lines[index + 1]) : [];
    const header = tableCells(line);
    if (
      line.includes("|") &&
      separator.length === header.length &&
      separator.every((cell) => /^:?-{3,}:?$/u.test(cell))
    ) {
      const rows: AssistantInline[][][] = [];
      const align = separator.map((cell): "left" | "center" | "right" =>
        cell.endsWith(":")
          ? cell.startsWith(":")
            ? "center"
            : "right"
          : "left",
      );
      index += 2;
      while (
        index < lines.length &&
        lines[index].trim() &&
        lines[index].includes("|") &&
        !blockStart(lines[index])
      ) {
        const cells = tableCells(lines[index++]);
        rows.push(
          header.map((_, column) => parseAssistantInline(cells[column] ?? "")),
        );
      }
      blocks.push({
        type: "table",
        header: header.map((cell) => parseAssistantInline(cell)),
        rows,
        align,
      });
      continue;
    }
    if (
      index + 1 < lines.length &&
      /^ {0,3}(?:=+|-+)[ \t]*$/u.test(lines[index + 1])
    ) {
      blocks.push({
        type: "heading",
        level: lines[index + 1].trim().startsWith("=") ? 1 : 2,
        children: parseAssistantInline(line),
      });
      index += 2;
      continue;
    }
    const paragraph = [line];
    index++;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !blockStart(lines[index])
    ) {
      if (
        index + 1 < lines.length &&
        lines[index].includes("|") &&
        tableCells(lines[index + 1]).every((cell) => /^:?-{3,}:?$/u.test(cell))
      )
        break;
      paragraph.push(lines[index++]);
    }
    blocks.push({
      type: "paragraph",
      children: parseAssistantInline(paragraph.join("\n")),
    });
  }
  return blocks;
}
