import { projectDate } from "./domain";
import type { SourceProgrammeIndex } from "./programme-source";
import type { ProjectReportResult } from "./project-reports";
import {
  matchesSavedScheduleQuery,
  normalizeSavedScheduleQuery,
} from "./schedule-search";
export { matchesSavedScheduleQuery } from "./schedule-search";

/** A deliberately small read-command grammar. Anything else goes to the real provider. */
export type CopilotReadCommand =
  | { kind: "lookahead"; from: string }
  | { kind: "schedule-search"; query: string };

export function parseCopilotReadCommand(
  message: string,
  now = new Date(),
): CopilotReadCommand | undefined {
  const text = message
    .trim()
    .replace(/[.!?]+$/, "")
    .trim();
  if (
    /^(?:(?:please )?(?:show(?: me)?|give(?: me)?|list|open) )?(?:the )?(?:next (?:two|2) weeks(?:['’])?(?: look[ -]?ahead)?|(?:two|2)[ -]week look[ -]?ahead|look[ -]?ahead (?:for )?(?:the )?next (?:two|2) weeks)$/i.test(
      text,
    ) ||
    /^(?:mostra(?:mi)? )?(?:(?:il |le )?look[ -]?ahead (?:delle )?|le )?prossime due settimane$/i.test(
      text,
    )
  )
    return { kind: "lookahead", from: projectDate(now) };
  const search = text.match(
    /^(?:please )?(?:show(?: me)?|list|find|search(?: for)?) (?:all |the )?([\p{L}\p{N}][\p{L}\p{N} _-]{0,79}) (?:on|in|from) (?:the )?(?:schedule|programme)$/iu,
  );
  if (!search) return undefined;
  const query = search[1].trim();
  // Do not turn compound questions, filters, mutations or quoted examples into commands.
  if (
    /\b(?:and|or|only|except|not|then|with|without|after|before|move|change|edit|delete|create|add|update|remove|assign|confirm|approve|overdue|late|critical|noncritical|completed?|done|pending|active|progress|unassigned|missing|untested|today|tomorrow|yesterday|days?|weeks?|months?|next|last|dates?|status|activities|equipment|assets?|tasks?|work|vendors?|suppliers?|phase|area|floor)\b/i.test(
      query,
    ) ||
    /\b(?:19|20)\d{2}\b/.test(query)
  )
    return undefined;
  return { kind: "schedule-search", query };
}

export function searchSavedSchedule(
  index: SourceProgrammeIndex,
  projectId: string,
  projectVersion: number,
  {
    query,
    offset = 0,
    limit = 20,
  }: { query: string; offset?: number; limit?: number },
) {
  const needle = normalizeSavedScheduleQuery(query);
  const matching = index.activities.filter((activity) =>
    matchesSavedScheduleQuery(activity, query),
  );
  const source = index.summary.sha256 !== "managed";
  const link = new URLSearchParams({
    projectId,
    ...(needle ? { q: needle } : {}),
  });
  return {
    dataOnly: true,
    scope: "complete-working-schedule" as const,
    query: needle,
    sourceSha256: index.summary.sha256,
    projectVersion,
    population: index.activities.length,
    total: matching.length,
    offset,
    limit,
    nextOffset: offset + limit < matching.length ? offset + limit : null,
    href: `/schedule?${link}`,
    records: matching.slice(offset, offset + limit).map((activity) => ({
      internalId: activity.internalId,
      activityId: activity.activityId,
      name: activity.name.slice(0, 200),
      start: activity.start,
      finish: activity.finish,
      status: activity.status,
      calendarId: activity.calendarId,
      calendarName: activity.calendarName.slice(0, 100),
      relationshipCount:
        index.byId.get(activity.internalId)?.relationships.length ?? 0,
      relationships:
        index.byId
          .get(activity.internalId)
          ?.relationships.slice(0, limit === 1 ? 30 : 3)
          .map((relationship) => ({
            sourceLine: relationship.sourceLine,
            predecessorId: relationship.predecessorId,
            predecessorActivityId: relationship.predecessorActivityId,
            successorId: relationship.successorId,
            successorActivityId: relationship.successorActivityId,
            type: relationship.type,
            lagHours: relationship.lagHours,
          })) ?? [],
      href: `/schedule?projectId=${encodeURIComponent(projectId)}&${source ? "activity" : "activityId"}=${encodeURIComponent(source ? activity.internalId : activity.activityId)}`,
    })),
    calendars: index.filters.calendars.slice(0, 30),
    recalculation: "explicit-dates-only",
  };
}
export type SavedScheduleSearch = ReturnType<typeof searchSavedSchedule>;

/** These are deterministic summaries of saved records, never generated AI text. */
export function savedLookaheadReply(result: ProjectReportResult) {
  const { coverage, window } = result;
  if (coverage.sourceUnavailable)
    return "Saved project report · no AI generation. The imported source Schedule is unavailable; the complete activity total is unknown. Refresh the report. This is not a zero result.";
  return [
    "Saved project report · no AI generation.",
    `${result.total} matching saved activities overlap ${window.from}–${window.through} (${result.timezone}, 14 days). Showing ${result.rows.length}; [open the complete filtered report](${result.href}).`,
    result.total === 0
      ? "No activities match this window and the report's active filters. This does not mean the project has no work."
      : "",
    `Population: ${coverage.activities} Schedule activities; ${coverage.undatedActivities} undated and ${coverage.overdueActivities} open overdue activities are counted separately. ${coverage.activitiesWithoutAssetLinks} activities in the window have no equipment link; ${coverage.activitiesMissingVendor} lack complete equipment-supplier mapping. These are not zero supplier demand or confirmed availability.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
export function savedScheduleSearchReply(result: SavedScheduleSearch) {
  return [
    "Saved Schedule search · no AI generation.",
    `${result.total} matching activities in the complete ${result.population}-activity working Schedule (IDs and names, imported P6 plus saved working changes). Showing ${result.records.length}; [open matching Schedule activities](${result.href}).`,
    result.total === 0
      ? "No Schedule activity IDs or names match this term. Equipment inventory is a separate population; this does not establish that no such equipment exists."
      : "Equipment inventory and saved tasks are separate populations; this search does not infer equipment mappings from activity names.",
  ].join("\n\n");
}

/** A provider narration failure cannot erase an already completed, authorized saved report. */
export function savedReportFallback(reports: ProjectReportResult[]) {
  if (!reports.length) return undefined;
  return [
    "The AI explanation did not finish. The saved reports below completed; any additional interpretation remains unanswered. No AI-generated explanation or applied change is claimed.",
    ...reports.map((report) =>
      report.report === "lookahead"
        ? savedLookaheadReply(report)
        : [
            `Saved ${report.report === "tagging" ? "tagging" : report.report === "works-to-go" ? "Works to go" : "equipment-supplier"} report · no AI generation.`,
            `${report.total} matching saved records under the report's visible filters. Showing ${report.rows.length}; [open the complete report](${report.href}).`,
            report.total === 0
              ? "No records match these filters. This does not establish that the project has no work."
              : "",
            report.coverage.sourceUnavailable
              ? "The source Schedule is unavailable; source-activity coverage is unknown, not zero."
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
    ),
  ].join("\n\n");
}

export function recoverCompletedReport(
  code: string,
  reports: ProjectReportResult[],
  toolFailure = false,
) {
  return !toolFailure &&
    ["timeout", "provider_unavailable", "invalid_response"].includes(code)
    ? savedReportFallback(reports)
    : undefined;
}
