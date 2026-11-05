import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { commissioning, type Commissioning } from "../src/lib/commissioning";
import {
  sourceProgrammeSummary,
  type SourceProgramme,
} from "../src/lib/programme-source";
import type { ProjectAuditEvent } from "../src/lib/project-audit";
import {
  appendProjectAuditQuery,
  commissioningWithAudit,
} from "../src/server/db/project-audit";

const at = "2026-11-05T16:00:00.000Z";
const source = (revision: "a" | "b"): SourceProgramme => ({
  format: "p6-xer-v1",
  source: {
    fileName: "synthetic-db-fixture.xer",
    sha256: revision.repeat(64),
    encoding: "utf-8",
    header: "ERMHDR\t15.2\t2026-11-05\tSynthetic database fixture",
  },
  tables: {
    TASK: {
      fields: ["task_id", "task_code", "task_name", "opaque_source_field"],
      rows: [
        [
          "fixture-task",
          "SYNTHETIC-1",
          `Source revision ${revision}`,
          "preserve verbatim",
        ],
      ],
      lines: [4],
    },
  },
});
const audit = (id: string): ProjectAuditEvent => ({
  id,
  at,
  actor: "Offline test admin",
  action: "download",
  label: "Synthetic register export",
  object: "Offline test project",
  detail: "Fixture evidence; no remote database or real client data",
});

test("large source programme is bound once in the serverless database request", () => {
  const programme = source("a");
  programme.tables.NOTE = {
    fields: ["text"],
    rows: [["x".repeat(900000)], ["y".repeat(900000)]],
    lines: [10, 11],
  };
  const query = new PgDialect().sqlToQuery(
    commissioningWithAudit({
      ...commissioning(),
      sourceProgramme: programme,
      sourceProgrammeSummary: sourceProgrammeSummary(programme),
    }),
  );
  const archives = query.params.filter(
    (value) => typeof value === "string" && value.length > 1024 * 1024,
  );
  assert.equal(
    archives.length,
    1,
    "Do not duplicate large archives in the database HTTP request",
  );
  assert(Buffer.byteLength(JSON.stringify(query.params)) < 2 * 1024 * 1024);
});

test("a newly provisioned project with a NULL commissioning column accepts its first source snapshot", async () => {
  const pg = new PGlite(),
    dialect = new PgDialect();
  try {
    await pg.exec(
      "CREATE TABLE projects (id text PRIMARY KEY, commissioning jsonb); INSERT INTO projects VALUES ('new-project',NULL)",
    );
    const empty = await pg.query<{ state: unknown }>(
      "SELECT commissioning - 'sourceProgramme' - '_audit' AS state FROM projects",
    );
    assert.equal(empty.rows[0].state, null);
    const programme = source("a"),
      state = {
        ...commissioning(),
        version: 1,
        sourceProgramme: programme,
        sourceProgrammeSummary: sourceProgrammeSummary(programme),
      };
    const compiled = dialect.sqlToQuery(
      sql`UPDATE projects SET commissioning=${commissioningWithAudit(state)} WHERE id='new-project' AND coalesce((commissioning->>'version')::integer,0)=0 RETURNING commissioning`,
    );
    const saved = await pg.query<{
      commissioning: Commissioning & { _audit: unknown[] };
    }>(compiled.sql, compiled.params);
    assert.equal(saved.rows.length, 1);
    assert.deepEqual(saved.rows[0].commissioning.sourceProgramme, programme);
    assert.deepEqual(saved.rows[0].commissioning._audit, []);
  } finally {
    await pg.close();
  }
});

test("PostgreSQL saves preserve omitted source data and audit, replace explicit source, and remove only an explicitly cleared source", async (t) => {
  const pg = new PGlite();
  const dialect = new PgDialect();
  const execute = async (query: ReturnType<typeof sql>) => {
    const compiled = dialect.sqlToQuery(query);
    return pg.query(compiled.sql, compiled.params);
  };
  const originalSource = source("a");
  const base: Commissioning = {
    ...commissioning(),
    version: 4,
    programmeId: "existing-working-programme",
    assets: [
      {
        id: "keep-asset",
        name: "Synthetic preserved equipment",
        equipmentType: "Pump",
        location: "Test room",
        levels: [],
      },
    ],
    schedule: [
      {
        activityId: "KEEP-SCHEDULE",
        name: "Synthetic preserved working activity",
        start: "2026-11-05",
        finish: "2026-11-06",
      },
    ],
    sourceProgramme: originalSource,
    sourceProgrammeSummary: sourceProgrammeSummary(originalSource),
    sourceProgrammeContentHash: "1".repeat(64),
    revisions: [
      {
        at,
        actor: "Offline test admin",
        action: "upload",
        reason: "Synthetic source fixture loaded",
        changes: ["One synthetic source activity"],
      },
    ],
  };
  type Persisted = Commissioning & { _audit: ProjectAuditEvent[] };
  const read = async () =>
    (
      await pg.query<{ commissioning: Persisted }>(
        "SELECT commissioning FROM projects WHERE id='p'",
      )
    ).rows[0].commissioning;
  const reset = () =>
    pg.query("UPDATE projects SET commissioning=$1::jsonb WHERE id='p'", [
      JSON.stringify({ ...base, _audit: [audit("before-save")] }),
    ]);
  const save = (next: Commissioning, expectedVersion: number) =>
    execute(
      sql`UPDATE projects SET commissioning=${commissioningWithAudit(next)}
      WHERE id='p' AND (commissioning->>'version')::integer=${expectedVersion}
      RETURNING id`,
    );
  const slimSnapshot = () => {
    const slim = { ...base };
    delete slim.sourceProgramme;
    return slim;
  };
  const assertOtherRecords = (state: Persisted) => {
    assert.deepEqual(state.assets, base.assets);
    assert.deepEqual(state.schedule, base.schedule);
    assert.equal(state.programmeId, base.programmeId);
  };
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    await pg.exec(
      "INSERT INTO companies(id,name)VALUES('c','Offline test company');" +
        "INSERT INTO users(id,name,email,role,company_id)VALUES('u','Offline admin','admin@offline.test','admin','c');" +
        "INSERT INTO projects(id,name,location,company_id)VALUES('p','Offline source test','','c');" +
        "INSERT INTO project_memberships(project_id,user_id)VALUES('p','u');",
    );

    await t.test(
      "an ordinary slim snapshot preserves persisted source data and the latest audit",
      async () => {
        await reset();
        const slim = slimSnapshot();
        assert.equal(Object.hasOwn(slim, "sourceProgramme"), false);
        // The audit append occurs after the client snapshot. Saving must retain it.
        await execute(
          appendProjectAuditQuery("p", "u", audit("after-snapshot"), base),
        );
        const next = {
          ...slim,
          version: 5,
          config: { ...slim.config, location: "Updated site context" },
        };
        assert.equal((await save(next, 4)).rows.length, 1);
        const persisted = await read();
        assert.deepEqual(persisted.sourceProgramme, originalSource);
        assert.deepEqual(
          persisted.sourceProgrammeSummary,
          base.sourceProgrammeSummary,
        );
        assert.equal(
          persisted.sourceProgrammeContentHash,
          base.sourceProgrammeContentHash,
        );
        assert.deepEqual(
          persisted._audit.map((event) => event.id),
          ["before-save", "after-snapshot"],
        );
        assert.deepEqual(persisted.revisions, base.revisions);
        assert.equal(persisted.config.location, "Updated site context");
        assertOtherRecords(persisted);
      },
    );

    await t.test(
      "an explicitly supplied new source replaces the old source without replacing audit or other work",
      async () => {
        await reset();
        const replacement = source("b");
        const revision = {
          at,
          actor: "Offline test admin",
          action: "upload" as const,
          reason: "Replace synthetic source fixture",
          changes: ["Synthetic revision b"],
        };
        const next: Commissioning = {
          ...slimSnapshot(),
          version: 5,
          sourceProgramme: replacement,
          sourceProgrammeSummary: sourceProgrammeSummary(replacement),
          sourceProgrammeContentHash: "2".repeat(64),
          revisions: [...base.revisions, revision],
        };
        assert.equal((await save(next, 4)).rows.length, 1);
        const persisted = await read();
        assert.deepEqual(persisted.sourceProgramme, replacement);
        assert.deepEqual(
          persisted.sourceProgrammeSummary,
          next.sourceProgrammeSummary,
        );
        assert.equal(persisted.sourceProgrammeContentHash, "2".repeat(64));
        assert.deepEqual(persisted.revisions, [...base.revisions, revision]);
        assert.deepEqual(persisted._audit, [audit("before-save")]);
        assertOtherRecords(persisted);
      },
    );

    await t.test(
      "own undefined clears source, summary and hash despite JSON omitting those keys",
      async () => {
        await reset();
        const revision = {
          at,
          actor: "Offline test admin",
          action: "edit" as const,
          reason: "Clear synthetic source fixture",
          changes: ["Explicit source-only removal fixture"],
        };
        const next: Commissioning = {
          ...slimSnapshot(),
          version: 5,
          sourceProgramme: undefined,
          sourceProgrammeSummary: undefined,
          sourceProgrammeContentHash: undefined,
          revisions: [...base.revisions, revision],
        };
        assert.equal(Object.hasOwn(next, "sourceProgramme"), true);
        assert.equal(
          Object.hasOwn(JSON.parse(JSON.stringify(next)), "sourceProgramme"),
          false,
        );
        await execute(
          appendProjectAuditQuery("p", "u", audit("before-clear"), base),
        );
        assert.equal((await save(next, 4)).rows.length, 1);
        const persisted = await read();
        for (const key of [
          "sourceProgramme",
          "sourceProgrammeSummary",
          "sourceProgrammeContentHash",
        ])
          assert.equal(
            Object.hasOwn(persisted, key),
            false,
            `${key} was explicitly cleared`,
          );
        assert.deepEqual(persisted.revisions, [...base.revisions, revision]);
        assert.deepEqual(
          persisted._audit.map((event) => event.id),
          ["before-save", "before-clear"],
        );
        assertOtherRecords(persisted);
        // A stale source-bearing snapshot must not resurrect what was removed.
        assert.equal((await save({ ...base, version: 5 }, 4)).rows.length, 0);
        assert.deepEqual(await read(), persisted);
      },
    );
  } finally {
    await pg.close();
  }
});
