import { z } from "zod";
import {
  sourceGanttViewSchema,
  sourceGanttViewCommandSchema,
} from "./source-gantt";
import {
  querySourceProgrammeIndex,
  type SourceProgrammeIndex,
} from "./programme-source";
export const scheduleViewSnapshotSchema = z
  .object({
    projectId: z.string().min(1).max(150),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    projectVersion: z.number().int().min(0),
    mode: z.literal("working"),
    page: z.number().int().min(0).max(100000),
    display: sourceGanttViewSchema.optional(),
    query: z
      .object({
        q: z.string().max(200).default(""),
        wbs: z.string().max(200).default(""),
        calendar: z.string().max(150).default(""),
        status: z.string().max(150).default(""),
        critical: z.enum(["all", "yes", "no", "unknown"]).optional(),
      })
      .strict(),
  })
  .strict();
export type ScheduleViewSnapshot = z.infer<typeof scheduleViewSnapshotSchema>;
export const scheduleViewStorageKey = (projectId: string) =>
  `fieldtrack:schedule-view:${projectId}`;
export const scheduleViewCommandEvent = "fieldtrack:schedule-view-command";
export const scheduleViewCommandResultEvent =
  "fieldtrack:schedule-view-command-result";
export const scheduleViewCommandSchema = z
  .object({
    projectId: scheduleViewSnapshotSchema.shape.projectId,
    sourceSha256: scheduleViewSnapshotSchema.shape.sourceSha256,
    projectVersion: scheduleViewSnapshotSchema.shape.projectVersion,
    command: sourceGanttViewCommandSchema,
    requestId: z.uuid().optional(),
  })
  .strict();
export type ScheduleViewCommand = z.infer<typeof scheduleViewCommandSchema>;
/** Local display commands carry the same scope/version as captured row references. */
export function resolveScheduleViewCommand(
  input: unknown,
  subject: { projectId: string; sourceSha256: string; projectVersion: number },
) {
  const value = scheduleViewCommandSchema.parse(input);
  if (
    value.projectId !== subject.projectId ||
    value.sourceSha256 !== subject.sourceSha256 ||
    value.projectVersion !== subject.projectVersion
  )
    throw Error(
      "The displayed Schedule changed. Reopen it before changing its view.",
    );
  return value.command;
}
/** A display row is resolved against the same full filtered working revision, never treated as an ID. */
export function resolveScheduleViewRow(
  index: SourceProgrammeIndex,
  input: unknown,
  subject: { projectId: string; projectVersion: number },
  rowNumber: number,
) {
  const snapshot = scheduleViewSnapshotSchema.parse(input);
  if (
    snapshot.projectId !== subject.projectId ||
    snapshot.sourceSha256 !== index.summary.sha256 ||
    snapshot.projectVersion !== subject.projectVersion
  )
    throw Error(
      "The displayed Schedule changed. Reopen it before referring to row numbers.",
    );
  if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > 1000000)
    throw Error("Choose a valid displayed row number.");
  const page = querySourceProgrammeIndex(index, {
    ...snapshot.query,
    page: Math.floor((rowNumber - 1) / 50),
    pageSize: 50,
  });
  const activity = page.activities[(rowNumber - 1) % 50];
  if (!activity)
    throw Error("That row is not present in the displayed filtered Schedule.");
  return { rowNumber, activity, total: page.total, query: snapshot.query };
}
