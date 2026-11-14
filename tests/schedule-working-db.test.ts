import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { workingScheduleCommitQuery } from "../src/server/db/schedule-working";
import { commissioning, type Commissioning } from "../src/lib/commissioning";
import type { Task, Activity } from "../src/lib/domain";

test("PostgreSQL working revision, unassigned task and audit are all-or-nothing with fresh role/membership/source/CAS", async () => {
  const pg = new PGlite(),
    dialect = new PgDialect(),
    at = "2026-11-14T12:00:00.000Z",
    sha = "a".repeat(64);
  const execute = async (q: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const parsed = dialect.sqlToQuery(q);
    return pg.query<{ projects: number; tasks: number; events: number }>(
      parsed.sql,
      parsed.params,
    );
  };
  const base = {
    ...commissioning(),
    version: 2,
    assets: [
      {
        id: "asset",
        name: "Pump",
        equipmentType: "Pump",
        location: "",
        levels: [],
      },
    ],
    sourceProgrammeSummary: { sha256: sha },
    sourceProgramme: { privateRaw: "must remain exact" },
    _audit: [{ id: "old-audit" }],
  } as unknown as Commissioning;
  const next = {
    ...commissioning(),
    version: 3,
    assets: base.assets,
    schedule: [
      { activityId: "FT-new", name: "Inspection", finish: "2026-12-10" },
    ],
    revisions: [
      {
        at,
        actor: "Manager",
        action: "edit" as const,
        reason: "Verified atomic working schedule change",
        changes: ["Added row and unassigned task"],
      },
    ],
  };
  const task: Task = {
    id: "new-task",
    title: "Inspection",
    description: "",
    projectId: "p",
    companyId: "c",
    createdBy: "u",
    status: "pending",
    cx: {
      kind: "task",
      assetId: "asset",
      activityId: "FT-new",
      result: "untested",
    },
    discipline: "",
    location: "",
    source: "manual",
    dueDate: "2026-12-10",
    createdAt: at,
    updatedAt: at,
    version: 1,
  };
  const event: Activity = {
    id: "new-event",
    taskId: task.id,
    actorId: "u",
    actorName: "Manager",
    action: "Created with schedule",
    note: "Atomic operation",
    createdAt: at,
  };
  const reset = async () => {
    await pg.exec(
      "DELETE FROM task_activities;DELETE FROM tasks;UPDATE users SET role='manager',modules=NULL WHERE id='u';INSERT INTO project_memberships(user_id,project_id)VALUES('u','p')ON CONFLICT DO NOTHING;",
    );
    await pg.query("UPDATE projects SET commissioning=$1::jsonb WHERE id='p'", [
      JSON.stringify(base),
    ]);
  };
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    await pg.exec(
      "INSERT INTO companies(id,name)VALUES('c','Test');INSERT INTO users(id,name,email,role,company_id)VALUES('u','Manager','manager@offline.test','manager','c');INSERT INTO projects(id,name,location,company_id)VALUES('p','Test','','c');",
    );
    await reset();
    assert.deepEqual(
      (
        await execute(
          workingScheduleCommitQuery("p", "u", next, 2, sha, task, event),
        )
      ).rows[0],
      { projects: 1, tasks: 1, events: 1 },
    );
    const saved = (
      await pg.query<{ commissioning: Record<string, unknown> }>(
        "SELECT commissioning FROM projects WHERE id='p'",
      )
    ).rows[0].commissioning;
    assert.deepEqual(saved.sourceProgramme, {
      privateRaw: "must remain exact",
    });
    assert.deepEqual(saved._audit, [{ id: "old-audit" }]);
    assert.equal(
      (await pg.query<{ assigned_to: null }>("SELECT assigned_to FROM tasks"))
        .rows[0].assigned_to,
      null,
    );
    assert.deepEqual(
      (
        await execute(
          workingScheduleCommitQuery("p", "u", next, 2, sha, task, event),
        )
      ).rows[0],
      { projects: 0, tasks: 0, events: 0 },
    );
    assert.equal((await pg.query("SELECT * FROM tasks")).rows.length, 1);
    for (const revoke of [
      "UPDATE users SET role='supervisor' WHERE id='u'",
      "DELETE FROM project_memberships WHERE user_id='u'",
      "UPDATE users SET modules='[\"tasks\"]'::jsonb WHERE id='u'",
      "UPDATE users SET modules='[\"commissioning\"]'::jsonb WHERE id='u'",
    ]) {
      await reset();
      await pg.exec(revoke);
      assert.deepEqual(
        (
          await execute(
            workingScheduleCommitQuery("p", "u", next, 2, sha, task, event),
          )
        ).rows[0],
        { projects: 0, tasks: 0, events: 0 },
      );
    }
    await reset();
    assert.deepEqual(
      (
        await execute(
          workingScheduleCommitQuery(
            "p",
            "u",
            next,
            2,
            "b".repeat(64),
            task,
            event,
          ),
        )
      ).rows[0],
      { projects: 0, tasks: 0, events: 0 },
    );
    await pg.query(
      "INSERT INTO tasks(id,title,description,project_id,company_id,created_by,status,discipline,location,source,version)VALUES('new-task','Existing','','p','c','u','pending','','','manual',1)",
    );
    await assert.rejects(
      execute(workingScheduleCommitQuery("p", "u", next, 2, sha, task, event)),
    );
    assert.equal(
      (
        await pg.query<{ version: number }>(
          "SELECT (commissioning->>'version')::integer AS version FROM projects WHERE id='p'",
        )
      ).rows[0].version,
      2,
      "Task collision rolls back the project row too",
    );
    assert.equal(
      (await pg.query("SELECT * FROM task_activities")).rows.length,
      0,
    );
  } finally {
    await pg.close();
  }
});
