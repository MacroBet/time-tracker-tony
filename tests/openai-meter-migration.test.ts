import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  METER_MIGRATION_SHA,
  METER_MIGRATION_TARGET,
  METER_PRIOR_HISTORY,
  assertMeterMigrationTarget,
  assertVercelMeterMigrationContext,
  assertMeterMigrationSql,
  preflightMeterMigration,
  applyMeterMigration,
  type MigrationAdapter,
  type MigrationQuery,
} from "../src/server/openai-meter-migration";
const migration = () =>
  readFile(
    new URL("../drizzle/0006_openai_meter_observations.sql", import.meta.url),
    "utf8",
  );
async function setup(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(
    "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint); CREATE TABLE projects(id text PRIMARY KEY); INSERT INTO projects VALUES('keep-project'); CREATE TABLE tasks(id text PRIMARY KEY);INSERT INTO tasks VALUES('keep-task')",
  );
  for (const [hash, stamp] of METER_PRIOR_HISTORY)
    await pg.query(
      "INSERT INTO drizzle.__drizzle_migrations(hash,created_at)VALUES($1,$2)",
      [hash, stamp],
    );
  const written: MigrationQuery[][] = [];
  const adapter: MigrationAdapter = {
    readOnly: (queries) =>
      pg.transaction(async (tx) => {
        await tx.exec("SET TRANSACTION READ ONLY");
        const results = [];
        for (const q of queries)
          results.push(
            (await tx.query<Record<string, unknown>>(q.text, q.values)).rows,
          );
        return results;
      }),
    atomic: async (queries) => {
      written.push(queries);
      await pg.transaction(async (tx) => {
        for (const q of queries) await tx.query(q.text, q.values);
      });
    },
  };
  return { pg, adapter, written };
}

test("target/checksum gates accept only exact host/database and pinned0006, without echoing URLs", async () => {
  const url =
    "postgresql://private-user:private-password@expected.neon.tech/expected";
  assert.doesNotThrow(() =>
    assertMeterMigrationTarget(url, "expected.neon.tech", "expected"),
  );
  for (const [host, db, target] of [
    ["other.neon.tech", "expected", METER_MIGRATION_TARGET],
    ["expected.neon.tech", "other", METER_MIGRATION_TARGET],
    ["expected.neon.tech", "expected", "other:Production"],
  ])
    assert.throws(
      () => assertMeterMigrationTarget(url, host, db, target),
      (error) =>
        error instanceof Error && !error.message.includes("private-password"),
    );
  assert.throws(() =>
    assertMeterMigrationTarget(
      "https://expected.neon.tech/expected",
      "expected.neon.tech",
      "expected",
    ),
  );
  assert.throws(() => assertMeterMigrationTarget(url, "", ""));
  assertMeterMigrationSql(await migration());
  assert.throws(() => assertMeterMigrationSql("DROP TABLE tasks;"));
});

test("default preflight is read-only, apply contains only0006 and journal, repeated exact apply is no-op", async (t) => {
  const { pg, adapter, written } = await setup(t),
    sql = await migration();
  assert.equal(
    (await preflightMeterMigration(adapter, sql)).state,
    "ready-to-apply",
  );
  assert.equal(written.length, 0);
  assert.equal(
    (
      await pg.query<{ meter: string | null }>(
        "SELECT to_regclass('public.openai_meter_observations') AS meter",
      )
    ).rows[0].meter,
    null,
  );
  await assert.rejects(applyMeterMigration(adapter, sql, ""), /approval/);
  assert.equal(written.length, 0);
  assert.equal(
    (await applyMeterMigration(adapter, sql, "human-approval-123456")).state,
    "applied",
  );
  assert.equal(written.length, 1);
  const statements = written[0];
  assert.equal(statements.filter((q) => q.text === sql).length, 1);
  assert(statements[0].text.includes("pg_advisory_xact_lock"));
  assert.equal(
    (
      await pg.query<{ hash: string }>(
        "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT1".replace(
          "LIMIT1",
          "LIMIT 1",
        ),
      )
    ).rows[0].hash,
    METER_MIGRATION_SHA,
  );
  assert.equal(
    (await applyMeterMigration(adapter, sql, "human-approval-123456")).state,
    "already-applied",
  );
  assert.equal(written.length, 1);
  assert.deepEqual((await pg.query("SELECT * FROM projects")).rows, [
    { id: "keep-project" },
  ]);
  assert.deepEqual((await pg.query("SELECT * FROM tasks")).rows, [
    { id: "keep-task" },
  ]);
});

test("preflight rejects missing/modified/future history and untracked meter table", async (t) => {
  const { pg, adapter } = await setup(t),
    sql = await migration();
  await pg.query(
    "UPDATE drizzle.__drizzle_migrations SET hash='wrong' WHERE created_at=$1",
    [METER_PRIOR_HISTORY[5][1]],
  );
  await assert.rejects(preflightMeterMigration(adapter, sql), /history/);
  await pg.query(
    "UPDATE drizzle.__drizzle_migrations SET hash=$1 WHERE created_at=$2",
    METER_PRIOR_HISTORY[5] as unknown as unknown[],
  );
  await pg.query(
    "INSERT INTO drizzle.__drizzle_migrations(hash,created_at)VALUES('unknown',9999999999999)",
  );
  await assert.rejects(preflightMeterMigration(adapter, sql), /history/);
  await pg.query(
    "DELETE FROM drizzle.__drizzle_migrations WHERE hash='unknown'",
  );
  await pg.exec(sql);
  await assert.rejects(preflightMeterMigration(adapter, sql), /untracked/);
});

test("failure on journal insertion rolls back meter DDL atomically; changed history after preflight blocks", async (t) => {
  const { pg, adapter } = await setup(t),
    sql = await migration();
  const failure: MigrationAdapter = {
    ...adapter,
    atomic: (queries) => adapter.atomic([...queries, { text: "SELECT 1/0" }]),
  };
  await assert.rejects(
    applyMeterMigration(failure, sql, "human-approval-123456"),
  );
  assert.equal(
    (
      await pg.query<{ meter: string | null }>(
        "SELECT to_regclass('public.openai_meter_observations') AS meter",
      )
    ).rows[0].meter,
    null,
  );
  assert.equal(
    (await preflightMeterMigration(adapter, sql)).state,
    "ready-to-apply",
  );
  const race: MigrationAdapter = {
    ...adapter,
    atomic: async (queries) => {
      await pg.query(
        "INSERT INTO drizzle.__drizzle_migrations(hash,created_at)VALUES('race',9999999999999)",
      );
      return adapter.atomic(queries);
    },
  };
  await assert.rejects(
    applyMeterMigration(race, sql, "human-approval-123456"),
    /history changed/,
  );
  assert.equal(
    (
      await pg.query<{ meter: string | null }>(
        "SELECT to_regclass('public.openai_meter_observations') AS meter",
      )
    ).rows[0].meter,
    null,
  );
});

test("already-applied preflight rejects a same-name CHECK whose actual definition drifted", async (t) => {
  const { pg, adapter } = await setup(t),
    sql = await migration();
  await applyMeterMigration(adapter, sql, "human-approval-123456");
  await pg.exec(
    "ALTER TABLE openai_meter_observations DROP CONSTRAINT openai_meter_phase; ALTER TABLE openai_meter_observations ADD CONSTRAINT openai_meter_phase CHECK (true)",
  );
  await assert.rejects(
    preflightMeterMigration(adapter, sql),
    /does not match the approved migration shape/,
  );
  await assert.rejects(
    applyMeterMigration(adapter, sql, "human-approval-123456"),
    /does not match the approved migration shape/,
  );
});

test("Vercel mode requires the exact production project and matching apply approval before DB access", () => {
  const environment = {
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: "prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz",
    VERCEL_PROJECT_NAME: "time-tracker-tony",
    VERCEL_PROJECT_PRODUCTION_URL: "time-tracker-tony.vercel.app",
    DATABASE_URL:
      "postgresql://synthetic:private-value@injected.neon.tech/production",
    FIELDTRACK_METER_MIGRATION_APPROVAL: "human-approval-123456",
  };
  assert.doesNotThrow(() => assertVercelMeterMigrationContext(environment));
  assert.doesNotThrow(() =>
    assertVercelMeterMigrationContext(
      environment,
      METER_MIGRATION_TARGET,
      "human-approval-123456",
    ),
  );
  for (const change of [
    { VERCEL_ENV: "preview" },
    { VERCEL_ENV: "development" },
    { VERCEL_PROJECT_ID: "other-project" },
    { VERCEL_PROJECT_NAME: "another-app" },
    { VERCEL_PROJECT_PRODUCTION_URL: "foreign.vercel.app" },
    { VERCEL_PROJECT_PRODUCTION_URL: "time-tracker-tony.vercel.app.evil.test" },
    {
      VERCEL_PROJECT_PRODUCTION_URL:
        "https://time-tracker-tony.vercel.app/other",
    },
    { DATABASE_URL: "" },
  ])
    assert.throws(
      () => assertVercelMeterMigrationContext({ ...environment, ...change }),
      (error) =>
        error instanceof Error && !error.message.includes("private-value"),
    );
  assert.throws(
    () =>
      assertVercelMeterMigrationContext(
        { ...environment, FIELDTRACK_METER_MIGRATION_APPROVAL: undefined },
        METER_MIGRATION_TARGET,
        "human-approval-123456",
      ),
    /approval/,
  );
  assert.throws(
    () =>
      assertVercelMeterMigrationContext(
        environment,
        METER_MIGRATION_TARGET,
        "another-approval",
      ),
    /approval/,
  );
  assert.throws(
    () =>
      assertVercelMeterMigrationContext(
        environment,
        METER_MIGRATION_TARGET,
        "",
      ),
    /approval/,
  );
  assert.throws(() =>
    assertVercelMeterMigrationContext(environment, "other:Production"),
  );
});
