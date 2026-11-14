import { LEVELS } from "./commissioning";
import { REPORT_TYPES } from "./project-reports";
import type { CopilotFunctionTool } from "./copilot-provider";
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
export const EXTENSION_TOOLS: CopilotFunctionTool[] = [
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
