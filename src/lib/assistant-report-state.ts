import { z } from "zod";
import { LEVELS } from "./commissioning";
import {
  REPORT_TYPES,
  reportQuerySchema,
  type ProjectReportQuery,
} from "./project-reports";
const nullableText = z.string().trim().max(150).nullable();
export const reportRefinementSchema = z
  .object({
    report: z.enum(REPORT_TYPES).nullable(),
    activity: z.string().trim().max(400).nullable().default(null),
    vendor: nullableText,
    level: z.enum(LEVELS).nullable(),
    late: z.enum(["all", "late", "not-late", "unknown"]).nullable(),
    discipline: nullableText,
    query: z.string().trim().max(200).nullable(),
    from: z.iso.date().nullable(),
    workStatus: z.enum(["open", "done", "all"]).nullable(),
    activityStatus: z.enum(["open", "done", "all"]).nullable(),
    offset: z.number().int().min(0).max(1000000).nullable(),
    limit: z.number().int().min(1).max(50).nullable(),
    reset: z.boolean(),
    clear: z
      .array(
        z.enum([
          "vendor",
          "level",
          "late",
          "discipline",
          "query",
          "from",
          "workStatus",
          "activityStatus",
          "activity",
        ]),
      )
      .max(9),
  })
  .strict();
export const assistantReportStateSchema = z
  .object({ projectId: z.string().min(1).max(150), query: reportQuerySchema })
  .strict();
export type AssistantReportState = z.infer<typeof assistantReportStateSchema>;
/** Null means keep the current filter. Clearing is always explicit. New report kinds start clean. */
export function refineAssistantReport(
  current: ProjectReportQuery | undefined,
  input: unknown,
): ProjectReportQuery {
  const change = reportRefinementSchema.parse(input);
  const fresh =
    change.reset ||
    (change.report !== null && change.report !== current?.report);
  const result: Record<string, unknown> = fresh
    ? { report: change.report ?? current?.report ?? "tagging" }
    : { ...current };
  for (const key of change.clear) delete result[key];
  for (const [key, value] of Object.entries(change))
    if (key !== "reset" && key !== "clear" && value !== null)
      result[key] = value;
  const filtersChanged =
    fresh ||
    change.clear.length > 0 ||
    [
      "vendor",
      "level",
      "late",
      "discipline",
      "query",
      "from",
      "workStatus",
      "activityStatus",
      "activity",
    ].some((key) => change[key as keyof typeof change] !== null);
  if (filtersChanged && change.offset === null) result.offset = 0;
  return reportQuerySchema.parse(result);
}
