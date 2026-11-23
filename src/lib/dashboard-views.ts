import {
  dashboardViewRequestSchema,
  type DashboardViewRequest,
} from "./dashboard-view-context";
import { reportQuerySchema, type ProjectReportQuery } from "./project-reports";

export const dashboardReportLabels = {
  tasks: "Tasks",
  tags: "Tag report",
  schedule: "Schedule records",
  handover: "Handover",
  conformance: "Conformance",
  equipment: "Equipment",
  trend: "Tag trend",
  tagging: "Test step progress",
  "works-to-go": "Works to go",
  vendors: "Equipment suppliers needed",
} as const;

/** One view URL for menu choices, assistant requests and previous report links. */
export function dashboardViewHref(
  projectId: string,
  view: DashboardViewRequest,
) {
  const params = new URLSearchParams({ projectId, panel: view.kind });
  if (view.kind === "progress") params.set("comparison", view.comparison);
  if (view.kind === "lookahead") params.set("weeks", String(view.weeks));
  if (view.kind === "vendor-progress") params.set("vendor", view.vendor);
  if (view.kind === "report") params.set("view", view.report);
  return `/overview?${params}`;
}

/** Keep older bookmarked report URLs and their filters readable without recreating tabs. */
export function dashboardViewFromParams(
  params: URLSearchParams,
  canDashboard = true,
) {
  const panel = params.get("panel");
  let raw: unknown;
  if (panel)
    raw =
      panel === "progress"
        ? { kind: panel, comparison: params.get("comparison") ?? "overall" }
        : panel === "lookahead"
          ? { kind: panel, weeks: Number(params.get("weeks") ?? 2) }
          : panel === "vendor-progress"
            ? { kind: panel, vendor: params.get("vendor") }
            : panel === "report"
              ? { kind: panel, report: params.get("view") }
              : { kind: panel };
  else if (
    params.get("tab") === "reports" ||
    params.has("report") ||
    params.has("view") ||
    !canDashboard
  ) {
    const report = params.get("view") ?? params.get("report") ?? "tags";
    raw =
      report === "lookahead"
        ? { kind: "lookahead", weeks: Number(params.get("weeks") ?? 2) }
        : { kind: "report", report };
  } else raw = { kind: "overview" };
  return dashboardViewRequestSchema.safeParse(raw);
}

export function dashboardReportQuery(
  params: URLSearchParams,
  view: DashboardViewRequest,
): ProjectReportQuery {
  const raw = Object.fromEntries(
    [...params].filter(([key]) => key in reportQuerySchema.shape),
  );
  if (view.kind === "lookahead")
    return reportQuerySchema.parse({
      ...raw,
      report: "lookahead",
      weeks: view.weeks,
    });
  if (view.kind === "report")
    return reportQuerySchema.parse({ ...raw, report: view.report });
  return reportQuerySchema.parse({});
}
