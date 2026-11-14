import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  CHAT_MIGRATION_SHA,
  CHAT_MIGRATION_TIME,
  CHAT_MIGRATION_TARGET,
  CHAT_PRIOR_HISTORY,
  assertChatMigrationApproval,
  assertVercelChatMigrationContext,
  assertAssistantConversationMigrationSql,
  preflightAssistantConversationMigration,
  applyAssistantConversationMigration,
} from "../src/server/assistant-conversation-migration";
import {
  METER_MIGRATION_SHA,
  METER_MIGRATION_TIME,
  type MigrationAdapter,
  type MigrationQuery,
} from "../src/server/openai-meter-migration";

const migration = () =>
  readFile(
    new URL("../drizzle/0007_assistant_conversations.sql", import.meta.url),
    "utf8",
  );
const approval = "human-chat-approval-20261114";
const tags = [
  "0000_tiresome_wraith",
  "0001_tough_johnny_storm",
  "0002_ancient_warpath",
  "0003_peaceful_purifiers",
  "0004_mature_gladiator",
  "0005_outgoing_daredevil",
  "0006_openai_meter_observations",
];
async function setup(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(
    "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint);",
  );
  for (const [index, tag] of tags.entries()) {
    await pg.exec(
      await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), "utf8"),
    );
    await pg.query(
      "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)",
      [...CHAT_PRIOR_HISTORY[index]],
    );
  }
  await pg.exec(`INSERT INTO companies(id,name)VALUES('keep-company','Synthetic company');
    INSERT INTO users(id,name,email,role,company_id,modules)VALUES('keep-user','Synthetic manager','synthetic@example.test','manager','keep-company','["tasks","commissioning"]');
    INSERT INTO projects(id,name,location,company_id,commissioning)VALUES('keep-project','Synthetic project','Local demo','keep-company','{"version":7}');
    INSERT INTO project_memberships(user_id,project_id)VALUES('keep-user','keep-project');
    INSERT INTO tasks(id,title,description,project_id,company_id,assigned_to,created_by,discipline,source)VALUES('keep-task','Preserved work','Synthetic task','keep-project','keep-company','keep-user','keep-user','Synthetic','manual');
    INSERT INTO openai_meter_observations(attempt_id,phase,observation)VALUES('keep-attempt','pending','{"event":{"attemptId":"keep-attempt","provider":"openai"},"outcome":"started"}');`);
  const written: MigrationQuery[][] = [];
  const adapter: MigrationAdapter = {
    readOnly: (queries) =>
      pg.transaction(async (tx) => {
        await tx.exec("SET TRANSACTION READ ONLY");
        const results = [];
        for (const query of queries)
          results.push(
            (await tx.query<Record<string, unknown>>(query.text, query.values))
              .rows,
          );
        return results;
      }),
    atomic: async (queries) => {
      written.push(queries);
      await pg.transaction(async (tx) => {
        for (const query of queries) await tx.query(query.text, query.values);
      });
    },
  };
  return { pg, adapter, written };
}
async function coreRows(pg: PGlite) {
  const result: Record<string, unknown> = {};
  for (const table of [
    "companies",
    "users",
    "projects",
    "project_memberships",
    "tasks",
    "openai_meter_observations",
  ])
    result[table] = (await pg.query(`SELECT * FROM ${table}`)).rows;
  return result;
}
async function tableExists(pg: PGlite) {
  return (
    await pg.query<{ name: string | null }>(
      "SELECT to_regclass('public.assistant_conversations') AS name",
    )
  ).rows[0].name;
}

test("0007 pins the exact SQL, journal timestamp and complete0000–0006 meter baseline", async () => {
  assert.equal(CHAT_PRIOR_HISTORY.length, 7);
  assert.deepEqual(CHAT_PRIOR_HISTORY[6], [
    METER_MIGRATION_SHA,
    String(METER_MIGRATION_TIME),
  ]);
  const journal = JSON.parse(
    await readFile(
      new URL("../drizzle/meta/_journal.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(journal.entries[7].tag, "0007_assistant_conversations");
  assert.equal(journal.entries[7].when, CHAT_MIGRATION_TIME);
  assertAssistantConversationMigrationSql(await migration());
  assert.throws(() =>
    assertAssistantConversationMigrationSql("DROP TABLE tasks;"),
  );
});

test("preflight is read-only; apply is atomic, exact and idempotent with all existing rows/permissions unchanged", async (t) => {
  const { pg, adapter, written } = await setup(t),
    sql = await migration();
  const before = await coreRows(pg);
  assert.equal(
    (await preflightAssistantConversationMigration(adapter, sql)).state,
    "ready-to-apply",
  );
  assert.equal(written.length, 0);
  assert.equal(await tableExists(pg), null);
  await assert.rejects(
    applyAssistantConversationMigration(adapter, sql, ""),
    /approval/u,
  );
  assert.equal(written.length, 0);
  assert.equal(
    (await applyAssistantConversationMigration(adapter, sql, approval)).state,
    "applied",
  );
  assert.equal(written.length, 1);
  assert(written[0][0].text.includes("pg_advisory_xact_lock"));
  assert(
    written[0][1].text.includes("LOCK TABLE drizzle.__drizzle_migrations"),
  );
  assert.equal(
    written[0].filter((query) =>
      /^(?:CREATE TABLE|ALTER TABLE|CREATE INDEX)/u.test(query.text),
    ).length,
    4,
  );
  assert(
    written[0].at(-1)?.text.includes("$chat_shape$"),
    "Schema is verified inside the same transaction as DDL and journal insertion.",
  );
  assert.deepEqual(await coreRows(pg), before);
  const history = await pg.query<{ hash: string; created_at: string }>(
    "SELECT hash,created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY created_at,id",
  );
  assert.deepEqual(
    history.rows.map((row) => [row.hash, row.created_at]),
    [...CHAT_PRIOR_HISTORY, [CHAT_MIGRATION_SHA, String(CHAT_MIGRATION_TIME)]],
  );
  assert.equal(
    (await applyAssistantConversationMigration(adapter, sql, approval)).state,
    "already-applied",
  );
  assert.equal(written.length, 1);
  assert.deepEqual(await coreRows(pg), before);
  await pg.query(
    "INSERT INTO assistant_conversations(id,user_id,project_id,title)VALUES($1,'keep-user','keep-project','Synthetic chat')",
    ["00000000-0000-4000-8000-000000000001"],
  );
  assert.equal(
    (await preflightAssistantConversationMigration(adapter, sql)).state,
    "already-applied",
  );
});

test("preflight refuses unknown/missing meter history and an untracked same-name relation", async (t) => {
  const { pg, adapter, written } = await setup(t),
    sql = await migration();
  await pg.query(
    "UPDATE drizzle.__drizzle_migrations SET hash='wrong' WHERE created_at=$1",
    [METER_MIGRATION_TIME],
  );
  await assert.rejects(
    preflightAssistantConversationMigration(adapter, sql),
    /history/u,
  );
  await pg.query(
    "UPDATE drizzle.__drizzle_migrations SET hash=$1 WHERE created_at=$2",
    [METER_MIGRATION_SHA, METER_MIGRATION_TIME],
  );
  await pg.exec(
    "INSERT INTO drizzle.__drizzle_migrations(hash,created_at)VALUES('future',9999999999999)",
  );
  await assert.rejects(
    preflightAssistantConversationMigration(adapter, sql),
    /history/u,
  );
  await pg.exec(
    "DELETE FROM drizzle.__drizzle_migrations WHERE hash='future'; CREATE TABLE assistant_conversations();",
  );
  await assert.rejects(
    preflightAssistantConversationMigration(adapter, sql),
    /untracked/u,
  );
  assert.equal(written.length, 0);
});

test("journal failure and in-transaction schema drift roll back both0007 DDL and history", async (t) => {
  const { pg, adapter } = await setup(t),
    sql = await migration();
  const journalFailure: MigrationAdapter = {
    ...adapter,
    atomic: (queries) =>
      adapter.atomic(
        queries.map((query) =>
          query.text.startsWith("INSERT INTO drizzle.__drizzle_migrations")
            ? { text: "INSERT INTO missing_journal_table VALUES(1)" }
            : query,
        ),
      ),
  };
  await assert.rejects(
    applyAssistantConversationMigration(journalFailure, sql, approval),
  );
  assert.equal(await tableExists(pg), null);
  assert.equal(
    (await preflightAssistantConversationMigration(adapter, sql)).state,
    "ready-to-apply",
  );
  const shapeFailure: MigrationAdapter = {
    ...adapter,
    atomic: (queries) =>
      adapter.atomic([
        ...queries.slice(0, -1),
        {
          text: "ALTER TABLE assistant_conversations ADD COLUMN unexpected text",
        },
        queries.at(-1)!,
      ]),
  };
  await assert.rejects(
    applyAssistantConversationMigration(shapeFailure, sql, approval),
    /shape verification failed/u,
  );
  assert.equal(await tableExists(pg), null);
  assert.equal(
    (await preflightAssistantConversationMigration(adapter, sql)).state,
    "ready-to-apply",
  );
});

test("history and table races after preflight are rejected under the migration lock", async (t) => {
  const { pg, adapter } = await setup(t),
    sql = await migration();
  const changedHistory: MigrationAdapter = {
    ...adapter,
    atomic: async (queries) => {
      await pg.exec(
        "INSERT INTO drizzle.__drizzle_migrations(hash,created_at)VALUES('race',9999999999999)",
      );
      return adapter.atomic(queries);
    },
  };
  await assert.rejects(
    applyAssistantConversationMigration(changedHistory, sql, approval),
    /history changed/u,
  );
  assert.equal(await tableExists(pg), null);
  await pg.exec("DELETE FROM drizzle.__drizzle_migrations WHERE hash='race'");
  const appearedTable: MigrationAdapter = {
    ...adapter,
    atomic: async (queries) => {
      await pg.exec("CREATE TABLE assistant_conversations()");
      return adapter.atomic(queries);
    },
  };
  await assert.rejects(
    applyAssistantConversationMigration(appearedTable, sql, approval),
    /appeared after preflight/u,
  );
});

test("applied schema verification rejects altered checks, defaults, indexes and permission grants", async (t) => {
  const { pg, adapter } = await setup(t),
    sql = await migration();
  await applyAssistantConversationMigration(adapter, sql, approval);
  for (const mutation of [
    "ALTER TABLE assistant_conversations DROP CONSTRAINT assistant_conversations_title; ALTER TABLE assistant_conversations ADD CONSTRAINT assistant_conversations_title CHECK(true)",
    "ALTER TABLE assistant_conversations ALTER COLUMN version SET DEFAULT 7",
    "DROP INDEX assistant_conversations_owner_project_updated_idx; CREATE INDEX assistant_conversations_owner_project_updated_idx ON assistant_conversations(project_id,user_id)",
    "GRANT SELECT ON assistant_conversations TO PUBLIC",
  ]) {
    await pg.exec(mutation);
    await assert.rejects(
      preflightAssistantConversationMigration(adapter, sql),
      /does not match/u,
    );
    await pg.exec("DROP TABLE assistant_conversations");
    await pg.query("DELETE FROM drizzle.__drizzle_migrations WHERE hash=$1", [
      CHAT_MIGRATION_SHA,
    ]);
    await applyAssistantConversationMigration(adapter, sql, approval);
  }
});

test("exact Vercel context uses a distinct matching chat approval, never the meter approval", () => {
  const environment = {
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: "prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz",
    VERCEL_PROJECT_NAME: "time-tracker-tony",
    VERCEL_PROJECT_PRODUCTION_URL: "time-tracker-tony.vercel.app",
    DATABASE_URL:
      "postgresql://synthetic:private-value@injected.neon.tech/production",
    FIELDTRACK_CHAT_MIGRATION_APPROVAL: approval,
  };
  assert.doesNotThrow(() => assertVercelChatMigrationContext(environment));
  assert.doesNotThrow(() =>
    assertVercelChatMigrationContext(
      environment,
      CHAT_MIGRATION_TARGET,
      approval,
    ),
  );
  for (const change of [
    { VERCEL_ENV: "preview" },
    { VERCEL_PROJECT_ID: "foreign" },
    { VERCEL_PROJECT_NAME: "foreign" },
    { VERCEL_PROJECT_PRODUCTION_URL: "time-tracker-tony.vercel.app.evil.test" },
    { DATABASE_URL: "" },
  ])
    assert.throws(
      () => assertVercelChatMigrationContext({ ...environment, ...change }),
      (error) =>
        error instanceof Error && !error.message.includes("private-value"),
    );
  assert.throws(
    () =>
      assertVercelChatMigrationContext(
        {
          ...environment,
          FIELDTRACK_CHAT_MIGRATION_APPROVAL: undefined,
          FIELDTRACK_METER_MIGRATION_APPROVAL: approval,
        },
        CHAT_MIGRATION_TARGET,
        approval,
      ),
    /approval/u,
  );
  assert.throws(
    () => assertChatMigrationApproval(environment, "another-chat-approval"),
    /approval/u,
  );
  assert.throws(() =>
    assertVercelChatMigrationContext(environment, "other:Production"),
  );
});

test("CLI rejects invalid flags and missing approval before constructing any database client", () => {
  const script = fileURLToPath(
    new URL("../scripts/migrate-assistant-conversations.ts", import.meta.url),
  );
  for (const args of [
    ["--unknown"],
    ["--apply"],
    ["--vercel-production", "--apply", "--approval-id", approval],
    ["--approval-id", approval],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", script, ...args],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          VERCEL_ENV: "preview",
        },
      },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /Scoped assistant conversation migration stopped/u,
    );
    assert.doesNotMatch(result.stderr, /postgres(?:ql)?:\/\//u);
  }
});
