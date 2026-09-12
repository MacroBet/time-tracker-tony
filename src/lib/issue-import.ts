import { z } from "zod";
import type { TaskStatus } from "./domain";
export const issueImportSchema = z.object({
  file: z.string().min(1),
  issues: z
    .array(
      z.object({
        row: z.number().int().min(2),
        fields: z.record(z.string(), z.string().nullable()),
        createdAt: z.iso.datetime({ offset: true }),
        updatedAt: z.iso.datetime({ offset: true }),
        dueDate: z.iso.date().nullable(),
      }),
    )
    .min(1)
    .max(10000),
});
export function mapIssue(fields: Record<string, string | null>) {
  const statuses: Record<string, TaskStatus> = {
    Open: "pending",
    "Ready to inspect": "in-progress",
    "In dispute": "blocked",
    Answered: "in-progress",
    "Work completed": "completed",
    "Not approved": "blocked",
  };
  const status = statuses[fields.Status || ""];
  const assigneeType = z
    .enum(["User", "Company", "Role"])
    .parse(fields["Assignee type"]);
  const assignee = z.string().trim().min(1).parse(fields["Assigned to"]);
  const externalId = z
    .string()
    .regex(/^#?\d+$/)
    .parse(fields.ID)
    .replace(/^#/, "");
  if (!status || !fields.Title?.trim())
    throw new Error("Missing title or unsupported source status");
  const priority = /\bP([123])\b/.exec(fields.Type || "")?.[0] as
    "P1" | "P2" | "P3" | undefined;
  const company =
    assigneeType === "Company"
      ? assignee
      : fields["Company name"]?.trim() ||
        (assigneeType === "User"
          ? assignee.split("\n").slice(1).join(" ").trim()
          : "") ||
        "Company not mapped";
  return { externalId, status, priority, assigneeType, assignee, company };
}
