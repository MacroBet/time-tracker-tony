import { LEVELS } from "./commissioning";
import { z } from "zod";
import { dashboardViewRequestSchema } from "./dashboard-view-context";
import { REPORT_TYPES } from "./project-reports";
import type { CopilotFunctionTool } from "./copilot-provider";
export { canRequestDashboardView } from "./dashboard-view-context";
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const nullable = (values?: readonly string[], maxLength = 150) => ({
  type: ["string", "null"],
  ...(values ? { enum: [...values, null] } : { maxLength }),
});
const int = (min: number, max: number) => ({
  type: ["integer", "null"],
  minimum: min,
  maximum: max,
});
const tool = (
  name: string,
  description: string,
  parameters: Record<string, unknown>,
): CopilotFunctionTool => ({
  type: "function",
  name,
  description,
  parameters,
  strict: true,
});
const reportFields = {
  report: nullable(REPORT_TYPES),
  activity: nullable(undefined, 400),
  vendor: nullable(),
  level: nullable(LEVELS),
  late: nullable(["all", "late", "not-late", "unknown"]),
  discipline: nullable(),
  query: nullable(undefined, 200),
  from: nullable(undefined, 10),
  workStatus: nullable(["open", "done", "all"]),
  activityStatus: nullable(["open", "done", "all"]),
  offset: int(0, 1000000),
  limit: int(1, 50),
  reset: { type: "boolean" },
  clear: {
    type: "array",
    maxItems: 9,
    items: {
      type: "string",
      enum: [
        "vendor",
        "level",
        "late",
        "discipline",
        "query",
        "from",
        "workStatus",
        "activityStatus",
        "activity",
      ],
    },
  },
};
const dashboardKinds = [
  "overview",
  "issues",
  "progress",
  "lookahead",
  "vendor-progress",
  "report",
  "readiness",
] as const;
const dashboardReports = [
  "tasks",
  "tags",
  "schedule",
  "handover",
  "conformance",
  "equipment",
  "trend",
  "tagging",
  "works-to-go",
  "vendors",
] as const;
/** Nullable strict tool fields become the same scoped request used by manual controls. */
export const dashboardViewToolInputSchema = z
  .object({
    kind: z.enum(dashboardKinds),
    comparison: z.enum(["overall", "current", "critical"]).nullable(),
    weeks: z.union([z.literal(2), z.literal(4), z.literal(6)]).nullable(),
    vendor: z.string().trim().min(1).max(150).nullable(),
    report: z.enum(dashboardReports).nullable(),
  })
  .strict()
  .transform((value) =>
    Object.fromEntries(
      Object.entries(value).filter(([, field]) => field !== null),
    ),
  )
  .pipe(dashboardViewRequestSchema);

export const EXTENSION_TOOLS: CopilotFunctionTool[] = [
  tool(
    "review_import",
    "Review the current project's saved import and report criteria. Returns aggregate populations, readiness, missing mappings/dates/tag applicability/checksheets and concrete source links. A programme import does not create asset/tag/supplier records. Missing responses or approvals are incomplete work, not proof of a broken report. Never invent criteria or fill gaps. Read-only; no records are changed.",
    object({}),
  ),
  tool(
    "display_dashboard_view",
    "Request a supported view on the current Dashboard: overall/original-current/saved-P6-critical progress, Issues overview, 2/4/6-week lookahead, exact equipment-supplier progress, a report, or import readiness. Use only in response to an explicit display request. Set unused fields null. A request is PENDING browser acknowledgement: never claim the screen has changed, a report succeeded or data was modified. The application checks the active project/version, access and actual rendered view before acknowledging. Critical means saved P6 classification, not a new CPM or a Phase 1 path. Tag report means report=tags (approvals); tagging means separate test-step progress. vendor is the exact supplier name from authorized saved records, not owner/manufacturer/assignee. No data writes.",
    object({
      kind: { type: "string", enum: dashboardKinds },
      comparison: nullable(["overall", "current", "critical"]),
      weeks: { type: ["integer", "null"], enum: [2, 4, 6, null] },
      vendor: nullable(),
      report: nullable(dashboardReports),
    }),
  ),
  tool(
    "project_report",
    "Show or refine tagging, actual Works to go, a 14-day activity lookahead or equipment suppliers required for that same window. Vendor means explicitly recorded EQUIPMENT SUPPLIER. Null retains current filter; clear removes named fields; reset starts fresh. Filters accumulate and are visible. Combine all filters requested in one message in a single call. activity is a canonical verified activity reference for Gantt drilldown, null retains it. Exact total precedes paging; missing mappings are not zero or on-time. __missing__ selects unclassified vendor/discipline, __conflict__ discipline conflicts. Step % counts explicit passed required applicable checksheet steps; approval/signatures separate. from is complete ISO date or null for today.",
    object(reportFields),
  ),
  tool(
    "search_schedule_activities",
    "Resolve real stable IDs in the current visible working Schedule, including imported P6 rows and created asset activities. Query IDs/names; returns exact total, source hash, saved dates and page relationships. Use rowNumber only when the application supplies a valid displayed Schedule snapshot; the server resolves that row under its exact filters/version. Use returned IDs for proposals. Without a snapshot ask for activity ID/name; never guess from row numbers.",
    object({
      query: { type: "string", maxLength: 200 },
      rowNumber: int(1, 1000000),
      offset: { type: "integer", minimum: 0, maximum: 1000000 },
      limit: { type: "integer", minimum: 1, maximum: 20 },
    }),
  ),
  tool(
    "propose_asset_activity",
    "Prepare a DRAFT activity for an existing asset, unassigned task and entry in the SAME working Schedule. Needs verified assetId, meaningful title and complete YYYY-MM-DD deadline; ask for missing/ambiguous title or month/year/weekday. start may be null (explicitly unknown). No write and no automatic assignment. Human must separately review and confirm.",
    object({
      assetId: { type: "string", maxLength: 150 },
      title: { type: "string", maxLength: 150 },
      description: nullable(undefined, 5000),
      start: nullable(undefined, 10),
      deadline: { type: "string", maxLength: 10 },
      reason: { type: "string", maxLength: 1000 },
    }),
  ),
  tool(
    "propose_schedule_edit",
    "Prepare a DRAFT change to an existing stable Schedule internalId resolved by search_schedule_activities. Explicit ISO date edits; add multiple incoming/outgoing relations; remove stable sourceLine IDs. assetIds explicitly associates equipment suppliers to this existing activity; null retains mappings, [] clears. Keep all other relationships, original source, actuals/baselines/calendars. No P6-equivalent recalculation claimed; preview reports affected downstream records. Human separately reviews/confirms; no write.",
    object({
      internalId: { type: "string", maxLength: 150 },
      start: nullable(undefined, 10),
      finish: nullable(undefined, 10),
      addLinks: {
        type: ["array", "null"],
        maxItems: 100,
        items: object({
          predecessorId: { type: "string", maxLength: 150 },
          successorId: { type: "string", maxLength: 150 },
          type: { type: "string", enum: ["PR_FS", "PR_SS", "PR_FF", "PR_SF"] },
          lagHours: { type: "number", minimum: -87600, maximum: 87600 },
        }),
      },
      assetIds: {
        type: ["array", "null"],
        maxItems: 200,
        items: { type: "string", maxLength: 150 },
      },
      removeLinkIds: {
        type: ["array", "null"],
        maxItems: 100,
        items: { type: "integer" },
      },
      reason: { type: "string", maxLength: 1000 },
    }),
  ),
  tool(
    "search_project_library",
    "Search assets, issues and curated lessons ONLY within already-authorized projects. This is the explicit cross-project library exception. Use projectId null for all allowed projects; never infer access from project names. Results have compound project identities and source links. No saving/publishing lessons or copying private notes.",
    object({
      query: { type: "string", maxLength: 200 },
      projectId: nullable(),
      kind: { type: "string", enum: ["all", "asset", "issue", "lesson"] },
      offset: { type: "integer", minimum: 0, maximum: 1000000 },
      limit: { type: "integer", minimum: 1, maximum: 20 },
    }),
  ),
];
