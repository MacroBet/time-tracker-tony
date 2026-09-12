import { assignmentQuery } from "../src/server/db/assignment";
import { attachmentInsertQuery } from "../src/server/db/attachment-insert";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { createDemoData } from "../src/lib/demo-data";
import * as schema from "../src/server/db/schema";
import { taskUpdateQuery } from "../src/server/db/task-update";
test("PostgreSQL migration, constraints and atomic optimistic updates", async () => {
  const pg = new PGlite();
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    const db = drizzle(pg);
    const data = createDemoData();
    await db.insert(schema.companies).values(data.companies);
    await db.insert(schema.users).values(data.users);
    await db.insert(schema.projects).values(data.projects);
    await db.insert(schema.memberships).values(data.memberships);
    await db.insert(schema.tasks).values(data.tasks);
    await db.insert(schema.tasks).values({
      ...data.tasks[0],
      id: "imported-excel",
      source: "excel",
      externalId: "90001",
      assignedTo: null,
      priority: null,
      importData: {
        file: "report.xlsx",
        row: 2,
        status: "Open",
        assignee: "Company A",
        assigneeType: "Company",
        importedAt: new Date().toISOString(),
        fields: { Status: "Open" },
      },
    });
    const imported = (
      await pg.query<{ assigned_to: string | null; priority: string | null }>(
        "SELECT assigned_to, priority FROM tasks WHERE id = 'imported-excel'",
      )
    ).rows[0];
    assert.equal(imported.assigned_to, null);
    assert.equal(imported.priority, null);
    const task = {
      ...data.tasks[0],
      notes: "Verified on site.",
      status: "completed" as const,
      completedAt: new Date().toISOString(),
      version: 2,
    };
    const event = {
      id: "event1",
      taskId: task.id,
      actorId: "u1",
      actorName: "Marco",
      action: "Completed",
      note: task.notes,
      createdAt: task.updatedAt,
    };
    const dialect = new PgDialect();
    const first = dialect.sqlToQuery(taskUpdateQuery(task, event, 1));
    assert.equal((await pg.query(first.sql, first.params)).rows.length, 1);
    const stale = dialect.sqlToQuery(
      taskUpdateQuery(task, { ...event, id: "stale-event" }, 1),
    );
    assert.equal((await pg.query(stale.sql, stale.params)).rows.length, 0);
    assert.equal(
      (await pg.query("SELECT * FROM task_activities")).rows.length,
      1,
    );
    const reopen = dialect.sqlToQuery(
      taskUpdateQuery(
        { ...task, status: "in-progress", completedAt: undefined, version: 3 },
        { ...event, id: "reopen" },
        2,
      ),
    );
    await pg.query(reopen.sql, reopen.params);
    assert.equal(
      (
        await pg.query<{ completed_at: string | null }>(
          "SELECT completed_at FROM tasks WHERE id = $1",
          [task.id],
        )
      ).rows[0].completed_at,
      null,
    );
    const file = {
      id: "file1",
      taskId: task.id,
      uploadedBy: "u1",
      name: "test.png",
      contentType: "image/png",
      size: 4,
      data: "dGVzdA==",
      createdAt: new Date().toISOString(),
    };
    const upload = dialect.sqlToQuery(
      attachmentInsertQuery(file, { ...event, id: "upload1" }, 3),
    );
    assert.equal((await pg.query(upload.sql, upload.params)).rows.length, 1);
    const staleUpload = dialect.sqlToQuery(
      attachmentInsertQuery(
        { ...file, id: "file2" },
        { ...event, id: "upload2" },
        3,
      ),
    );
    assert.equal(
      (await pg.query(staleUpload.sql, staleUpload.params)).rows.length,
      0,
    );
    assert.equal((await pg.query("SELECT * FROM attachments")).rows.length, 1);
    assert.equal(
      (
        await pg.query<{ version: number }>(
          "SELECT version FROM tasks WHERE id = $1",
          [task.id],
        )
      ).rows[0].version,
      4,
    );
    const assignments = data.tasks
      .slice(1, 3)
      .map((t, i) => ({
        task: { ...t, assignedTo: "u1" },
        expectedVersion: 1,
        activity: { ...event, id: `assignment-${i}`, taskId: t.id },
      }));
    const failedAssignment = dialect.sqlToQuery(
      assignmentQuery(
        assignments.map((a, i) => ({
          ...a,
          expectedVersion: i === 1 ? 99 : 1,
        })),
      ),
    );
    assert.equal(
      (await pg.query(failedAssignment.sql, failedAssignment.params)).rows
        .length,
      0,
    );
    const unchanged = await pg.query<{ assigned_to: string }>(
      "SELECT assigned_to FROM tasks WHERE id=$1",
      [assignments[0].task.id],
    );
    assert.equal(unchanged.rows[0].assigned_to, data.tasks[1].assignedTo);
    const successfulAssignment = dialect.sqlToQuery(
      assignmentQuery(assignments),
    );
    assert.equal(
      (await pg.query(successfulAssignment.sql, successfulAssignment.params))
        .rows.length,
      2,
    );
    await db.insert(schema.shifts).values({
      id: "active-1",
      userId: "u1",
      projectId: "p1",
      startTime: new Date().toISOString(),
      status: "active",
    });
    await assert.rejects(
      db.insert(schema.shifts).values({
        id: "active-2",
        userId: "u1",
        projectId: "p1",
        startTime: new Date().toISOString(),
        status: "active",
      }),
    );
    await assert.rejects(
      db
        .insert(schema.tasks)
        .values({ ...data.tasks[0], id: "duplicate-external-id" }),
    );
    await assert.rejects(
      db
        .insert(schema.memberships)
        .values({ userId: "missing", projectId: "p1" }),
    );
  } finally {
    await pg.close();
  }
});
