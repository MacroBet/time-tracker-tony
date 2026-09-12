import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { and, eq } from "drizzle-orm";
import { scriptDb } from "./env";
import * as s from "../src/server/db/schema";
import { issueImportSchema, mapIssue } from "../src/lib/issue-import";

try {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      project: { type: "string" },
      actor: { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  if (!values.file || !values.project || !values.actor)
    throw new Error(
      "Required: --file staging.json --project project-id --actor email [--apply]",
    );
  const input = issueImportSchema.parse(
    JSON.parse(await readFile(values.file, "utf8")),
  );
  const mapped = input.issues.map((row) => ({
    ...row,
    mapped: mapIssue(row.fields),
  }));
  if (new Set(mapped.map((r) => r.mapped.externalId)).size !== mapped.length)
    throw new Error("Duplicate external IDs in report");
  const db = scriptDb();
  const actor = (
    await db.select().from(s.users).where(eq(s.users.email, values.actor))
  )[0];
  if (!actor || !["admin", "manager"].includes(actor.role))
    throw new Error("Import requires a manager or admin");
  const project = (
    await db.select().from(s.projects).where(eq(s.projects.id, values.project))
  )[0];
  if (
    !project ||
    !(
      await db
        .select()
        .from(s.memberships)
        .where(
          and(
            eq(s.memberships.userId, actor.id),
            eq(s.memberships.projectId, project.id),
          ),
        )
    ).length
  )
    throw new Error("Actor must belong to target project");
  const existing = new Set(
    (
      await db
        .select({ id: s.tasks.externalId })
        .from(s.tasks)
        .where(
          and(eq(s.tasks.projectId, project.id), eq(s.tasks.source, "excel")),
        )
    ).map((t) => t.id),
  );
  const pending = mapped.filter((r) => !existing.has(r.mapped.externalId));
  console.log(
    JSON.stringify({
      rows: mapped.length,
      insert: pending.length,
      skipExisting: mapped.length - pending.length,
      apply: values.apply,
    }),
  );
  if (values.apply && pending.length) {
    const importedAt = new Date().toISOString();
    const stableId = (kind: string, key: string) =>
      `excel-${kind}-${createHash("sha256").update(`${project.id}:${key}`).digest("hex").slice(0, 32)}`;
    const companies = [...new Set(pending.map((r) => r.mapped.company))].map(
      (name) => ({ id: stableId("company", name), name, logo: "" }),
    );
    const tasks = pending.map(({ fields, mapped: m, ...row }) => ({
      id: stableId("issue", m.externalId),
      projectId: project.id,
      companyId: stableId("company", m.company),
      createdBy: actor.id,
      title: fields.Title!,
      description: fields.Description || "",
      status: m.status,
      priority: m.priority ?? null,
      discipline: fields.Type || "Not specified",
      location: [fields.Location, fields["Location details"]]
        .filter(Boolean)
        .join(" · "),
      source: "excel" as const,
      externalId: m.externalId,
      dueDate: row.dueDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      notes: fields.Response || null,
      importData: {
        file: input.file,
        row: row.row,
        status: fields.Status!,
        assignee: m.assignee,
        assigneeType: m.assigneeType,
        importedAt,
        fields,
      },
    }));
    const events = tasks.map((t) => ({
      id: randomUUID(),
      taskId: t.id,
      actorId: actor.id,
      actorName: actor.name,
      action: "Issue imported from Excel",
      note: `Original status: ${t.importData.status}. Assignee (${t.importData.assigneeType}): ${t.importData.assignee}. Source row ${t.importData.row}.`,
      createdAt: importedAt,
    }));
    // One transaction: no partially imported report, no overwrite of existing activities.
    await db.batch([
      db.insert(s.companies).values(companies).onConflictDoNothing(),
      db.insert(s.tasks).values(tasks),
      db.insert(s.activities).values(events),
    ]);
    console.log(
      `Imported ${tasks.length} issues with original metadata and audit entries.`,
    );
  }
} catch {
  console.error(
    "Import failed. Check input schema, unique IDs, actor/project membership and database connectivity. Credentials and issue contents withheld.",
  );
  process.exitCode = 1;
}
