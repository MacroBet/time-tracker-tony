import type { DashboardViewRequest } from "./dashboard-view-context";

export type DashboardViewIntent = {
  view: DashboardViewRequest;
  description: string;
};

/** A small display grammar, separate from generated answers and saved-data review. */
export function parseDashboardViewCommand(
  message: string,
): DashboardViewIntent | null {
  const source = message
    .trim()
    .replace(/[.!]+$/, "")
    .trim();
  if (!source || /[\r\n?;"“”`]/.test(source)) return null;
  const text = source.toLowerCase().replace(/\s+/g, " ");
  const show = "(?:please )?(?:show(?: me)?|open) (?:the )?";

  if (new RegExp(`^${show}(?:main )?(?:dashboard|overview)$`).test(text))
    return {
      view: { kind: "overview" },
      description: "Opened the project Dashboard overview.",
    };
  if (
    new RegExp(`^${show}(?:(?:saved )?p6 )?crit(?:ical|ival) path$`).test(text)
  )
    return {
      view: { kind: "progress", comparison: "critical" },
      description:
        "Opened the saved P6 critical activity view. Data availability and coverage are shown on the Dashboard. This does not recalculate a critical path.",
    };
  if (
    new RegExp(
      `^${show}(?:original (?:vs\\.?|versus|and) current(?: (?:curve|curves|plan|plans))?|original curve (?:vs\\.?|versus) current)$`,
    ).test(text)
  )
    return {
      view: { kind: "progress", comparison: "current" },
      description:
        "Opened the original and current Schedule comparison view. Data availability and coverage are shown on the Dashboard.",
    };
  if (
    new RegExp(
      `^${show}(?:overall|project) (?:progress|curve|progress curve)$`,
    ).test(text)
  )
    return {
      view: { kind: "progress", comparison: "overall" },
      description:
        "Opened the overall project progress view. Data availability and coverage are shown on the Dashboard.",
    };
  const horizon = text.match(
    new RegExp(
      `^${show}(?:(two|2|four|4|six|6)[ -]weeks? look[ -]?ahead(?: report)?|next (two|2|four|4|six|6) weeks(?: look[ -]?ahead)?|look[ -]?ahead (?:for )?(?:the )?next (two|2|four|4|six|6) weeks)$`,
    ),
  );
  if (horizon) {
    const count = horizon[1] ?? horizon[2] ?? horizon[3];
    const weeks = ["two", "2"].includes(count)
      ? 2
      : ["four", "4"].includes(count)
        ? 4
        : 6;
    return {
      view: { kind: "lookahead", weeks },
      description: `Opened the Schedule lookahead view for the next ${weeks} weeks. Data availability and coverage are shown on the Dashboard.`,
    };
  }
  if (
    /^(?:(?:please )?(?:review|check|inspect) (?:the )?(?:project )?import|(?:please )?(?:show(?: me)?|open) (?:the )?(?:import (?:review|readiness)|missing (?:report )?criteria|report readiness))$/.test(
      text,
    )
  )
    return {
      view: { kind: "readiness" },
      description:
        "Opened the import and report criteria review. Data availability and coverage are shown on the Dashboard. No values are invented or changed.",
    };

  const reportNames: [string, DashboardViewRequest & { kind: "report" }][] = [
    [
      "tags? report|tag approvals?(?: report)?",
      { kind: "report", report: "tags" },
    ],
    ["tasks? report", { kind: "report", report: "tasks" }],
    ["schedule report", { kind: "report", report: "schedule" }],
    ["handover report", { kind: "report", report: "handover" }],
    ["conformance report", { kind: "report", report: "conformance" }],
    ["equipment report", { kind: "report", report: "equipment" }],
    ["trend report", { kind: "report", report: "trend" }],
    [
      "(?:test )?step progress(?: report)?|tagging step progress(?: report)?",
      { kind: "report", report: "tagging" },
    ],
    [
      "works?[ -]to[ -]go(?: report)?",
      { kind: "report", report: "works-to-go" },
    ],
    [
      "equipment suppliers?(?: needed)?(?: report)?|vendor report|supplier report",
      { kind: "report", report: "vendors" },
    ],
  ];
  for (const [pattern, view] of reportNames)
    if (new RegExp(`^${show}(?:${pattern})$`).test(text))
      return {
        view,
        description:
          view.report === "tags"
            ? "Opened the Tag report view. Data availability and coverage are shown on the Dashboard. Tag approvals remain separate from test step progress."
            : "Opened the requested project report view. Data availability and coverage are shown on the Dashboard.",
      };

  const vendorMatch = source.match(
    /^(?:please\s+)?(?:show(?:\s+me)?|open)\s+(?:the\s+)?(?:vendor|supplier)\s+(.{1,150})\s+progress$/i,
  );
  const vendor = vendorMatch?.[1].trim();
  if (
    vendor &&
    /^[\p{L}\p{N}][\p{L}\p{N} '&+()._/-]*$/u.test(vendor) &&
    !/\b(?:and|or|then|also|but|only|except|not|without|with|if|after|before|move|change|edit|delete|create|add|update|remove|assign|confirm|approve|import|export|send|email)\b/i.test(
      vendor,
    )
  )
    return {
      view: { kind: "vendor-progress", vendor },
      description: `Opened the progress view for equipment supplier ${vendor}. Data availability and coverage are shown on the Dashboard. No supplier mappings are inferred.`,
    };
  return null;
}
