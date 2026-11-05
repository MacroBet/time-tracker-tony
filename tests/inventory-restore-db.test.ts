import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { commissioning, type Commissioning } from "../src/lib/commissioning";
import type { Task, Activity } from "../src/lib/domain";
import {
  inventoryRestoreQuery,
  guardedTaskInsertQuery,
  guardedTaskUpdateQuery,
  guardedTaskPlanQuery,
  guardedTagTasksQuery,
} from "../src/server/db/inventory-restore";

test("restore and all new task-link writers guard both stale-snapshot orderings in PostgreSQL", async () => {
  const pg = new PGlite();
  const dialect = new PgDialect();
  const execute = async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const q = dialect.sqlToQuery(query);
    return pg.query(q.sql, q.params);
  };
  const at = "2026-11-05T16:00:00.000Z";
  const base: Commissioning = {
    ...commissioning(),
    version: 4,
    assets: [
      {
        id: "victim",
        name: "Victim",
        equipmentType: "Pump",
        location: "",
        levels: [],
      },
      {
        id: "survivor",
        name: "Preserve",
        equipmentType: "Pump",
        location: "",
        levels: [],
      },
    ],
  };
  const restored = {
    ...base,
    version: 5,
    assets: base.assets.filter((a) => a.id !== "victim"),
  };
  const task = (id: string, assetId?: string): Task => ({
    id,
    title: id,
    description: "Test",
    projectId: "p",
    companyId: "c",
    createdBy: "u",
    status: "pending",
    discipline: "Cx",
    location: "",
    source: "manual",
    createdAt: at,
    updatedAt: at,
    version: 1,
    ...(assetId ? { cx: { kind: "task", assetId, result: "untested" } } : {}),
  });
  const event = (id: string, taskId: string): Activity => ({
    id,
    taskId,
    actorId: "u",
    actorName: "Admin",
    action: "Test",
    note: "Offline SQL validation",
    createdAt: at,
  });
  const reset = async () => {
    await pg.exec("DELETE FROM task_activities; DELETE FROM tasks;");
    await pg.query("UPDATE projects SET commissioning=$1::jsonb WHERE id='p'", [
      JSON.stringify({ ...base, _audit: [{ id: "audit-preserved" }] }),
    ]);
  };
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const e of journal.entries)
      await pg.exec(await readFile(`drizzle/${e.tag}.sql`, "utf8"));
    await pg.exec(
      "INSERT INTO companies(id,name)VALUES('c','Test');INSERT INTO users(id,name,email,role,company_id)VALUES('u','Admin','admin@offline.test','admin','c');INSERT INTO projects(id,name,location,company_id)VALUES('p','Test','','c');",
    );
    await reset();
    // Writer using the old app snapshot commits first: the project version moves,
    // so restore must fail even if its task-table snapshot did not see the insert.
    assert.equal(
      (
        await execute(
          guardedTaskInsertQuery(
            task("linked", "victim"),
            event("created", "linked"),
          ),
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await execute(inventoryRestoreQuery("p", restored, 4, ["victim"]))).rows
        .length,
      0,
    );
    assert.equal(
      (await pg.query("SELECT * FROM tasks WHERE id='linked'")).rows.length,
      1,
    );
    // Even a refreshed version cannot remove a currently referenced asset.
    assert.equal(
      (
        await execute(
          inventoryRestoreQuery("p", { ...restored, version: 6 }, 5, [
            "victim",
          ]),
        )
      ).rows.length,
      0,
    );
    // Restore commits first: a stale app's new link must fail atomically, without audit.
    await reset();
    assert.equal(
      (await execute(inventoryRestoreQuery("p", restored, 4, ["victim"]))).rows
        .length,
      1,
    );
    assert.equal(
      (
        await execute(
          guardedTaskInsertQuery(
            task("stale", "victim"),
            event("stale-event", "stale"),
          ),
        )
      ).rows.length,
      0,
    );
    assert.equal((await pg.query("SELECT * FROM tasks")).rows.length, 0);
    assert.equal(
      (await pg.query("SELECT * FROM task_activities")).rows.length,
      0,
    );
    const state = (
      await pg.query<{
        commissioning: Commissioning & { _audit: { id: string }[] };
      }>("SELECT commissioning FROM projects WHERE id='p'")
    ).rows[0].commissioning;
    assert.deepEqual(
      state.assets.map((a) => a.id),
      ["survivor"],
    );
    assert.equal(state._audit[0].id, "audit-preserved");
    // New link via task update also invalidates a restore's original snapshot.
    await reset();
    const plain = task("plain");
    assert.equal(
      (
        await execute(
          guardedTaskInsertQuery(plain, event("plain-event", "plain")),
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await execute(
          guardedTaskUpdateQuery(
            {
              ...plain,
              cx: { kind: "task", assetId: "victim", result: "untested" },
              version: 2,
            },
            event("linked-event", "plain"),
            1,
          ),
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await execute(inventoryRestoreQuery("p", restored, 4, ["victim"]))).rows
        .length,
      0,
    );
    assert.equal(
      (
        await execute(
          guardedTaskUpdateQuery(
            {
              ...plain,
              cx: { kind: "task", assetId: "survivor", result: "untested" },
            },
            event("stale-update", "plain"),
            1,
          ),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await pg.query("SELECT * FROM task_activities WHERE id='stale-update'"))
        .rows.length,
      0,
    );
    await reset();
    assert.equal(
      (
        await execute(
          guardedTaskInsertQuery(plain, event("plain-event", "plain")),
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await execute(inventoryRestoreQuery("p", restored, 4, ["victim"]))).rows
        .length,
      1,
    );
    assert.equal(
      (
        await execute(
          guardedTaskUpdateQuery(
            {
              ...plain,
              cx: { kind: "task", assetId: "victim", result: "untested" },
            },
            event("after-restore", "plain"),
            1,
          ),
        )
      ).rows.length,
      0,
    );
    const saved = (
      await pg.query<{ cx: null; version: number }>(
        "SELECT cx,version FROM tasks WHERE id='plain'",
      )
    ).rows[0];
    assert.equal(saved.cx, null);
    assert.equal(saved.version, 1);
    // Planning writes cx as well and must preserve its existing metadata scope.
    await reset();
    await execute(guardedTaskInsertQuery(plain, event("plain-event", "plain")));
    const planned = {
      ...plain,
      title: "Planned title",
      discipline: "Mechanical",
      priority: "P2" as const,
      cx: {
        kind: "task" as const,
        assetId: "victim",
        result: "untested" as const,
      },
    };
    assert.equal(
      (
        await execute(
          guardedTaskPlanQuery(planned, event("plan-event", "plain"), 1),
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await execute(inventoryRestoreQuery("p", restored, 4, ["victim"]))).rows
        .length,
      0,
    );
    const plannedRow = (
      await pg.query<{ title: string; discipline: string; priority: string }>(
        "SELECT title,discipline,priority FROM tasks WHERE id='plain'",
      )
    ).rows[0];
    assert.equal(plannedRow.title, "Planned title");
    assert.equal(plannedRow.discipline, "Mechanical");
    assert.equal(plannedRow.priority, "P2");
    await reset();
    await execute(guardedTaskInsertQuery(plain, event("plain-event", "plain")));
    await execute(inventoryRestoreQuery("p", restored, 4, ["victim"]));
    assert.equal(
      (
        await execute(
          guardedTaskPlanQuery(planned, event("stale-plan", "plain"), 1),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await pg.query("SELECT * FROM task_activities WHERE id='stale-plan'"))
        .rows.length,
      0,
    );
    // Bulk generation is a writer too. A missing asset cancels the whole batch.
    await reset();
    const tags = [task("tag-a", "victim"), task("tag-b", "survivor")].map(
      (t) => ({
        ...t,
        cx: { ...t.cx!, kind: "tag" as const, level: "L1" as const },
      }),
    );
    assert.equal((await execute(guardedTagTasksQuery(tags))).rows.length, 2);
    assert.equal(
      (await execute(inventoryRestoreQuery("p", restored, 4, ["victim"]))).rows
        .length,
      0,
    );
    const versionBeforeRepeat = (
      await pg.query<{ version: number }>(
        "SELECT (commissioning->>'version')::integer AS version FROM projects WHERE id='p'",
      )
    ).rows[0].version;
    assert.equal((await execute(guardedTagTasksQuery(tags))).rows.length, 0);
    assert.equal(
      (
        await pg.query<{ version: number }>(
          "SELECT (commissioning->>'version')::integer AS version FROM projects WHERE id='p'",
        )
      ).rows[0].version,
      versionBeforeRepeat,
    );
    await reset();
    assert.equal(
      (await execute(inventoryRestoreQuery("p", restored, 4, ["victim"]))).rows
        .length,
      1,
    );
    assert.equal((await execute(guardedTagTasksQuery(tags))).rows.length, 0);
    assert.equal((await pg.query("SELECT * FROM tasks")).rows.length, 0);
  } finally {
    await pg.close();
  }
});
