import { createElement, memo, type ReactNode } from "react";
import {
  parseAssistantMarkdown,
  type AssistantBlock,
  type AssistantInline,
} from "@/lib/assistant-markdown";

function inline(nodes: AssistantInline[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return node.text;
    if (node.type === "break") return <br key={index} />;
    if (node.type === "code")
      return (
        <code
          key={index}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-900"
        >
          {node.text}
        </code>
      );
    if (node.type === "strong")
      return (
        <strong key={index} className="font-semibold">
          {inline(node.children)}
        </strong>
      );
    if (node.type === "em") return <em key={index}>{inline(node.children)}</em>;
    if (node.type === "link") {
      const external = /^(?:https?:)?\/\//iu.test(node.href);
      return (
        <a
          key={index}
          href={node.href}
          {...(external
            ? {
                target: "_blank",
                rel: "noopener noreferrer",
                referrerPolicy: "no-referrer" as const,
              }
            : {})}
          className="rounded-sm text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {inline(node.children)}
        </a>
      );
    }
    return null;
  });
}

function blocks(nodes: AssistantBlock[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "paragraph")
      return <p key={index}>{inline(node.children)}</p>;
    if (node.type === "heading")
      return createElement(
        `h${node.level}`,
        {
          key: index,
          className: `font-semibold leading-snug ${node.level <= 2 ? "text-base" : "text-sm"}`,
        },
        inline(node.children),
      );
    if (node.type === "rule")
      return <hr key={index} className="border-slate-200" />;
    if (node.type === "quote")
      return (
        <blockquote
          key={index}
          className="space-y-2 border-l border-slate-300 pl-3 text-slate-700"
        >
          {blocks(node.children)}
        </blockquote>
      );
    if (node.type === "code")
      return (
        <pre
          key={index}
          tabIndex={0}
          aria-label={
            node.language ? `Code block: ${node.language}` : "Code block"
          }
          className="max-w-full overflow-x-auto rounded-lg bg-slate-100 p-3 text-sm leading-6 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <code className="font-mono">{node.text}</code>
        </pre>
      );
    if (node.type === "list") {
      const items = node.items.map((item, itemIndex) => (
        <li key={itemIndex} className="space-y-2 pl-1">
          {blocks(item)}
        </li>
      ));
      return node.ordered ? (
        <ol
          key={index}
          start={node.start}
          className="list-decimal space-y-1 pl-5"
        >
          {items}
        </ol>
      ) : (
        <ul key={index} className="list-disc space-y-1 pl-5">
          {items}
        </ul>
      );
    }
    if (node.type === "table")
      return (
        <div
          key={index}
          role="region"
          aria-label="Assistant response table"
          tabIndex={0}
          className="max-w-full overflow-x-auto rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Table from the assistant response
            </caption>
            <thead className="bg-slate-100">
              <tr>
                {node.header.map((cell, column) => (
                  <th
                    key={column}
                    scope="col"
                    style={{ textAlign: node.align[column] }}
                    className="min-w-28 border-b border-slate-200 px-3 py-2 align-top font-semibold"
                  >
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-slate-200 last:border-b-0"
                >
                  {row.map((cell, column) => (
                    <td
                      key={column}
                      style={{ textAlign: node.align[column] }}
                      className="min-w-28 px-3 py-2 align-top"
                    >
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    return null;
  });
}

/** Untrusted Markdown renders as React text/elements, never raw HTML. */
export const AssistantMarkdown = memo(function AssistantMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <div className="min-w-0 space-y-3 break-words text-sm leading-6 [overflow-wrap:anywhere]">
      {blocks(parseAssistantMarkdown(text))}
    </div>
  );
});
