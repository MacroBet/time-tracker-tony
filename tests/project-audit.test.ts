import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  appendProjectAuditQuery,
  commissioningWithAudit,
} from "../src/server/db/project-audit";
import { sql } from "drizzle-orm";
import {
  projectHistory,
  type ProjectAuditEvent,
} from "../src/lib/project-audit";
import { createDemoData } from "../src/lib/demo-data";
import { commissioning } from "../src/lib/commissioning";

const event = (id: string): ProjectAuditEvent => ({
  id,
  at: "2026-10-15T18:00:00.000Z",
  actor: "Test manager",
  action: "download",
  label: "Register export prepared",
  object: "register.csv",
  detail: "1 asset; CSV",
});
test("audit append and programme saves preserve each other atomically without a migration or version bump", async () => {
  const pg = new PGlite();
  const dialect = new PgDialect();
  async function execute(query: ReturnType<typeof sql>) {
    const compiled = dialect.sqlToQuery(query);
    return pg.query(compiled.sql, compiled.params);
  }
  try {
    await pg.exec(
      "CREATE TABLE projects(id text PRIMARY KEY, commissioning jsonb); CREATE TABLE project_memberships(project_id text, user_id text)",
    );
    const state = commissioning(createDemoData().projects[0]);
    await pg.query("INSERT INTO projects VALUES ('p1', $1), ('p2', NULL)", [
      JSON.stringify(state),
    ]);
    await pg.exec(
      "INSERT INTO project_memberships VALUES ('p1','manager'), ('p2','manager')",
    );
    assert.equal(
      (
        await execute(
          appendProjectAuditQuery("p1", "outsider", event("denied"), state),
        )
      ).rows.length,
      0,
    );
    await execute(
      appendProjectAuditQuery("p1", "manager", event("first"), state),
    );
    await execute(
      appendProjectAuditQuery("p1", "manager", event("second"), state),
    );
    const afterDownloads = (
      await pg.query<{
        commissioning: typeof state & { _audit: ProjectAuditEvent[] };
      }>("SELECT commissioning FROM projects WHERE id='p1'")
    ).rows[0].commissioning;
    assert.equal(afterDownloads.version, state.version);
    assert.deepEqual(
      afterDownloads._audit.map((e) => e.id),
      ["first", "second"],
    );
    const next = { ...state, version: state.version + 1, assets: [] };
    const saved = await execute(
      sql`UPDATE projects SET commissioning=${commissioningWithAudit(next)} WHERE id='p1' AND (commissioning->>'version')::integer=${state.version} RETURNING id`,
    );
    assert.equal(saved.rows.length, 1);
    assert.equal(
      (
        await execute(
          sql`UPDATE projects SET commissioning=${commissioningWithAudit(next)} WHERE id='p1' AND (commissioning->>'version')::integer=${state.version} RETURNING id`,
        )
      ).rows.length,
      0,
    );
    await execute(
      appendProjectAuditQuery("p1", "manager", event("third"), state),
    );
    const final = (
      await pg.query<{ commissioning: typeof afterDownloads }>(
        "SELECT commissioning FROM projects WHERE id='p1'",
      )
    ).rows[0].commissioning;
    assert.equal(final.version, next.version);
    assert.deepEqual(final.assets, []);
    assert.deepEqual(
      final._audit.map((e) => e.id),
      ["first", "second", "third"],
    );
    await execute(
      appendProjectAuditQuery("p2", "manager", event("initialize"), state),
    );
    const initialized = (
      await pg.query<{ commissioning: typeof afterDownloads }>(
        "SELECT commissioning FROM projects WHERE id='p2'",
      )
    ).rows[0].commissioning;
    assert.deepEqual(initialized.config, state.config);
    assert.equal(initialized._audit[0].id, "initialize");
  } finally {
    await pg.close();
  }
});
test("project history combines persisted revisions and scoped task events in stable reverse order", () => {
  const data = createDemoData();
  const project = data.projects[0];
  project.commissioning = {
    ...commissioning(project),
    revisions: [
      {
        at: "2026-10-14T12:00:00.000Z",
        actor: "Engineer",
        reason: "Verified programme revision",
        changes: ["Activity 1 updated"],
      },
    ],
  };
  const task = data.tasks.find((t) => t.projectId === project.id)!;
  const foreignTask = { ...task, id: "foreign", projectId: "other" };
  const activity = {
    id: "upload",
    taskId: task.id,
    actorId: "u1",
    actorName: "Worker",
    action: "Evidence uploaded",
    note: "test.pdf",
    createdAt: "2026-10-15T12:00:00.000Z",
  };
  const events = projectHistory(
    project,
    [...data.tasks, foreignTask],
    [activity, { ...activity, id: "excluded", taskId: "foreign" }],
    [event("export")],
  );
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((e) => e.action),
    ["download", "upload", "edit"],
  );
  assert(events[2].detail.includes("Verified programme revision"));
  assert.equal(events[1].object, task.title);
});
