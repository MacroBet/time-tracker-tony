import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMarkdown } from "../src/app/components/AssistantMarkdown";
import {
  parseAssistantInline,
  parseAssistantMarkdown,
  safeAssistantHref,
} from "../src/lib/assistant-markdown";

const render = (text: string) =>
  renderToStaticMarkup(createElement(AssistantMarkdown, { text }));

test("assistant bold and italic render as semantic emphasis, including nesting", () => {
  const html = render(
    "The **valve** is *open*, __tag__ is _ready_, and ***both*** work.\n\n**Outer *inner* text**.",
  );
  assert.match(html, /<strong[^>]*>valve<\/strong>/u);
  assert.match(html, /<em>open<\/em>/u);
  assert.match(html, /<strong[^>]*>tag<\/strong>/u);
  assert.match(html, /<em>ready<\/em>/u);
  assert.match(html, /<strong[^>]*><em>both<\/em><\/strong>/u);
  assert.match(html, /<strong[^>]*>Outer <em>inner<\/em> text<\/strong>/u);
  assert.match(
    render("asset_id_value and \\*literal\\*"),
    /asset_id_value and \*literal\*/u,
  );
});

test("paragraphs, headings, quotes and nested ordered/unordered lists retain structure", () => {
  const html = render(
    "## Project **status**\n\nFirst paragraph.\nSecond line.\n\n> Saved records only.\n>\n> **Review** the evidence.\n\n3. Inspect\n   - Check seal\n   - Record outcome\n4. Confirm\n\n---\n\nNext section\n============",
  );
  assert.match(html, /<h2[^>]*>Project <strong[^>]*>status<\/strong><\/h2>/u);
  assert.match(html, /<p>First paragraph\.\nSecond line\.<\/p>/u);
  assert.match(html, /<blockquote/u);
  assert.match(html, /<ol start="3"/u);
  assert.match(html, /<ul/u);
  assert.match(html, /<li[^>]*><p>Check seal<\/p><\/li>/u);
  assert.match(html, /<hr/u);
  assert.match(html, /<h1[^>]*>Next section<\/h1>/u);
});

test("inline and fenced code remain literal and an unfinished fence is safe while streaming", () => {
  const html = render(
    "Use `**literal** <img src=x>` or ``a ` tick``.\n\n```html\n<script>alert(1)</script>\n**not bold**\n```\n\nAfter code.",
  );
  assert.match(html, /<code[^>]*>\*\*literal\*\* &lt;img src=x&gt;<\/code>/u);
  assert.match(html, /a ` tick/u);
  assert.match(html, /aria-label="Code block: html"/u);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.doesNotMatch(html, /<script|<img/u);
  assert.match(html, /<p>After code\.<\/p>/u);
  assert.match(
    render('```json\n{"unfinished": true}'),
    /<pre[^>]*><code[^>]*>\{&quot;unfinished&quot;: true\}<\/code><\/pre>/u,
  );
  assert.match(render("A **partial"), /A \*\*partial/u);
  assert.match(
    render("A **partial answer**"),
    /<strong[^>]*>partial answer<\/strong>/u,
  );
});

test("safe links support absolute, relative, balanced destinations and labels with emphasis", () => {
  const html = render(
    '[**Asset**](/commissioning?projectId=p1&asset=a1) · [Docs](https://example.test/a_(b) "Documentation") · [Section](#saved) · <https://example.test/help>',
  );
  assert.match(html, /href="\/commissioning\?projectId=p1&amp;asset=a1"/u);
  assert.match(html, /<strong[^>]*>Asset<\/strong>/u);
  assert.match(html, /href="https:\/\/example\.test\/a_\(b\)"/u);
  assert.match(html, /rel="noopener noreferrer"/u);
  assert.match(html, /href="#saved"/u);
  assert.match(html, /href="https:\/\/example\.test\/help"/u);
  assert.equal(safeAssistantHref("../tasks/task-1"), "../tasks/task-1");
  assert.equal(safeAssistantHref("?view=tasks"), "?view=tasks");
  assert.equal(safeAssistantHref("http://example.test"), "http://example.test");
});

test("executable schemes, obfuscated controls and malformed URLs never become anchors", () => {
  for (const href of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,test",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\\\\evil.test/path",
    "https://bad host.test",
    "https://[broken",
  ]) {
    assert.equal(safeAssistantHref(href), undefined, href);
    assert.doesNotMatch(render(`[Click](${href})`), /<a\s/u, href);
  }
  assert.doesNotMatch(
    render(
      "[A](javascript:alert(1)) [B](data:text/html,<svg/onload=alert(1)>)",
    ),
    /href=/u,
  );
});

test("raw HTML and images stay escaped text with no active tags or remote image requests", () => {
  const html = render(
    '<script>alert("x")</script>\n\n<img src="https://remote.test/pixel" onerror="alert(1)">\n\n<iframe src="javascript:alert(1)"></iframe>\n\n![Remote image](https://remote.test/pixel.png)\n\n![Attack](javascript:alert(1))',
  );
  assert.match(html, /&lt;script&gt;/u);
  assert.match(html, /&lt;img/u);
  assert.match(
    html,
    /!\[Remote image\]\(https:\/\/remote\.test\/pixel\.png\)/u,
  );
  assert.doesNotMatch(html, /<(?:script|img|iframe|svg|link)\b/iu);
  assert.doesNotMatch(html, /href="(?:javascript|data):/iu);
});

test("common Markdown tables preserve headings, alignment, escaped pipes and code cells", () => {
  const html = render(
    "| Equipment | Outcome |\n| :--- | ---: |\n| **Chiller** | Passed |\n| Pump \\| standby | `a|b` |",
  );
  assert.match(html, /<table/u);
  assert.equal((html.match(/scope="col"/gu) ?? []).length, 2);
  assert.match(html, /text-align:right/u);
  assert.match(html, /<strong[^>]*>Chiller<\/strong>/u);
  assert.match(html, /Pump \| standby/u);
  assert.match(html, /<code[^>]*>a\|b<\/code>/u);
  assert.match(
    html,
    /role="region" aria-label="Assistant response table" tabindex="0"/u,
  );
});

test("deep or malformed markup is bounded and cannot produce nested anchors", () => {
  const nestedQuotes = `${"> ".repeat(50)}Still text`;
  assert.doesNotThrow(() => parseAssistantMarkdown(nestedQuotes));
  assert.doesNotThrow(() =>
    render("[unfinished](https://example.test/path_(nested)"),
  );
  const link = parseAssistantInline("[outer [inner](/tasks/1)](/tasks/2)");
  assert.equal(link[0].type, "link");
  assert.equal(
    (render("[outer [inner](/tasks/1)](/tasks/2)").match(/<a\s/gu) ?? [])
      .length,
    1,
  );
});
