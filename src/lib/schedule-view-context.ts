import { z } from "zod";
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
    query: z
      .object({
        q: z.string().max(200).default(""),
        wbs: z.string().max(200).default(""),
        calendar: z.string().max(150).default(""),
        status: z.string().max(150).default(""),
      })
      .strict(),
  })
  .strict();
export type ScheduleViewSnapshot = z.infer<typeof scheduleViewSnapshotSchema>;
export const scheduleViewStorageKey = (projectId: string) =>
  `fieldtrack:schedule-view:${projectId}`;
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
