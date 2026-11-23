import { z } from "zod";

/** These requests select saved-data views; they never describe a record mutation. */
export const dashboardViewRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("progress"),
      comparison: z.enum(["overall", "current", "critical"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("lookahead"),
      weeks: z.union([z.literal(2), z.literal(4), z.literal(6)]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("vendor-progress"),
      vendor: z.string().trim().min(1).max(150),
    })
    .strict(),
  z
    .object({
      kind: z.literal("report"),
      report: z.enum([
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
      ]),
    })
    .strict(),
  z.object({ kind: z.literal("readiness") }).strict(),
  z.object({ kind: z.literal("overview") }).strict(),
]);

export type DashboardViewRequest = z.infer<typeof dashboardViewRequestSchema>;

const scope = {
  projectId: z.string().min(1).max(150),
  projectVersion: z.number().int().min(0),
  requestId: z.uuid(),
};
export const dashboardViewCommandSchema = z
  .object({ ...scope, view: dashboardViewRequestSchema })
  .strict();
export const dashboardViewCommandResultSchema = z
  .object({
    ...scope,
    ok: z.boolean(),
    error: z.string().max(500).optional(),
  })
  .strict();
export type DashboardViewCommand = z.infer<typeof dashboardViewCommandSchema>;
export type DashboardViewCommandResult = z.infer<
  typeof dashboardViewCommandResultSchema
>;
export const dashboardViewCommandEvent = "fieldtrack:dashboard-view-command";
export const dashboardViewCommandResultEvent =
  "fieldtrack:dashboard-view-command-result";

/** The mounted Dashboard validates its actual project and revision before acknowledgement. */
export function resolveDashboardViewCommand(
  input: unknown,
  subject: { projectId: string; projectVersion: number },
): DashboardViewRequest {
  const request = dashboardViewCommandSchema.parse(input);
  if (
    request.projectId !== subject.projectId ||
    request.projectVersion !== subject.projectVersion
  )
    throw Error(
      "The displayed Dashboard changed. Refresh it before changing its view.",
    );
  return request.view;
}
