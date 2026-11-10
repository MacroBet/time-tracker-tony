import { createHash } from "node:crypto";

export const METER_MIGRATION_SHA =
  "cbaecd91b57e339d5577c86a439509ec690e90186b8fc2afe70e7e5966a95c04";
export const METER_MIGRATION_TIME = 1794337200000;
export const METER_MIGRATION_TARGET =
  "macrobets-projects/time-tracker-tony:Production";
export const METER_PRIOR_HISTORY = [
  [
    "9d5449d7b76bd9e8bfe8b08cd581b69a781aa7bb92bcc4f4a13abf5c4b1e7dba",
    "1789198725620",
  ],
  [
    "86c8f939eba672be37c2390c8ea94f614b8ad41a2612dac327c4fba316273288",
    "1789221045037",
  ],
  [
    "e3f2a4948b2591e9d0c97a4d0a02d0b010db5b267afe9c91684494174587d752",
    "1789221138008",
  ],
  [
    "417f2d663ecf2af7dd4c7b6ebb86ae69a3c58c19a9e89f0c165d45d52e67f1a4",
    "1789221746510",
  ],
  [
    "89abc0ca82bf70a16da41c6075ec9cfab5555c5ac2a9632595dae0b1ba0f85a4",
    "1790097859412",
  ],
  [
    "b53cd0267a0e3039cb0fbf465d40802d42512b8aadd71f05855da5566b6b027e",
    "1790097980325",
  ],
] as const;
export type MigrationQuery = { text: string; values?: unknown[] };
export type MigrationAdapter = {
  readOnly: (queries: MigrationQuery[]) => Promise<Record<string, unknown>[][]>;
  atomic: (queries: MigrationQuery[]) => Promise<unknown>;
};
const fail = (message: string): never => {
  throw new Error(message);
};
export function assertMeterMigrationTarget(
  connection: string,
  host: string,
  database: string,
  target = METER_MIGRATION_TARGET,
) {
  let url: URL;
  try {
    url = new URL(connection);
  } catch {
    return fail("Invalid database connection configuration.");
  }
  if (
    target !== METER_MIGRATION_TARGET ||
    !host ||
    !database ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== host ||
    decodeURIComponent(url.pathname.slice(1)) !== database ||
    (url.port && url.port !== "5432")
  )
    fail(
      "Database target does not match the explicitly approved host/database.",
    );
}
/** Logical target for a one-shot build in this exact existing Vercel production project.
 * No local dotenv values or alternate connection variables are accepted in this mode.
 */
export function assertVercelMeterMigrationContext(
  environment: Record<string, string | undefined>,
  target = METER_MIGRATION_TARGET,
  applyApprovalId?: string,
) {
  if (
    target !== METER_MIGRATION_TARGET ||
    environment.VERCEL_ENV !== "production" ||
    environment.VERCEL_PROJECT_ID !== "prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz" ||
    (environment.VERCEL_PROJECT_NAME !== undefined &&
      environment.VERCEL_PROJECT_NAME !== "time-tracker-tony")
  )
    fail(
      "Vercel migration context is not the exact approved production project.",
    );
  if (environment.VERCEL_PROJECT_PRODUCTION_URL !== undefined) {
    let url: URL;
    try {
      const value = environment.VERCEL_PROJECT_PRODUCTION_URL;
      url = new URL(value.includes("://") ? value : `https://${value}`);
    } catch {
      return fail("Vercel production URL does not match the approved project.");
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "time-tracker-tony.vercel.app" ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      fail("Vercel production URL does not match the approved project.");
  }
  if (
    applyApprovalId !== undefined &&
    (!/^[A-Za-z0-9][A-Za-z0-9:_-]{7,199}$/.test(applyApprovalId) ||
      environment.FIELDTRACK_METER_MIGRATION_APPROVAL !== applyApprovalId)
  )
    fail(
      "Vercel apply requires the matching explicit human approval identity.",
    );
  let connection: URL;
  try {
    connection = new URL(environment.DATABASE_URL || "");
  } catch {
    return fail("Production DATABASE_URL is not configured.");
  }
  if (
    !["postgres:", "postgresql:"].includes(connection.protocol) ||
    !connection.hostname ||
    connection.pathname.length < 2
  )
    fail("Production DATABASE_URL is not configured.");
}
export function assertMeterMigrationSql(migration: string) {
  if (
    createHash("sha256").update(migration).digest("hex") !== METER_MIGRATION_SHA
  )
    fail(
      "Meter migration checksum does not match the approved exact0006 file.",
    );
}
const historyQuery = {
  text: "SELECT hash, created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id",
};
const columnsQuery = {
  text: "SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='openai_meter_observations' ORDER BY ordinal_position",
};
const constraintsQuery = {
  text: "SELECT conname,contype,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=to_regclass('public.openai_meter_observations') ORDER BY conname",
};
function sameHistory(
  rows: Record<string, unknown>[],
  expected: readonly (readonly string[])[],
) {
  return (
    JSON.stringify(rows.map((row) => [row.hash, String(row.created_at)])) ===
    JSON.stringify(expected)
  );
}
const expectedCheckDefinitions: Record<string, string> = {
  openai_meter_phase:
    "CHECK ((phase = ANY (ARRAY['pending'::text, 'final'::text])))",
  openai_meter_payload:
    "CHECK (((jsonb_typeof(observation) = 'object'::text) AND (octet_length((observation)::text) <= 16000) AND (((observation -> 'event'::text) ->> 'attemptId'::text) = attempt_id) AND (((observation -> 'event'::text) ->> 'provider'::text) = 'openai'::text) AND (((phase = 'pending'::text) AND ((observation ->> 'outcome'::text) = 'started'::text)) OR ((phase = 'final'::text) AND ((observation ->> 'outcome'::text) <> 'started'::text)))))",
};
const canonicalConstraint = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
function verifyMeterTable(
  columns: Record<string, unknown>[],
  constraints: Record<string, unknown>[],
) {
  const expected = [
    ["attempt_id", "text", "NO"],
    ["phase", "text", "NO"],
    ["observation", "jsonb", "NO"],
    ["recorded_at", "timestamp with time zone", "NO"],
  ];
  const checks = constraints.filter((row) => row.contype === "c");
  if (
    JSON.stringify(
      columns.map((row) => [row.column_name, row.data_type, row.is_nullable]),
    ) !== JSON.stringify(expected) ||
    columns[3]?.column_default !== "now()" ||
    constraints.filter((row) => row.contype === "p").length !== 1 ||
    !constraints.some(
      (row) =>
        row.conname === "openai_meter_observations_pk" &&
        row.contype === "p" &&
        canonicalConstraint(row.definition) ===
          "PRIMARY KEY (attempt_id, phase)",
    ) ||
    checks.length !== Object.keys(expectedCheckDefinitions).length ||
    !Object.entries(expectedCheckDefinitions).every(([name, definition]) =>
      checks.some(
        (row) =>
          row.conname === name &&
          canonicalConstraint(row.definition) === definition,
      ),
    )
  )
    fail("Existing meter table does not match the approved migration shape.");
}
export async function preflightMeterMigration(
  adapter: MigrationAdapter,
  migration: string,
) {
  assertMeterMigrationSql(migration);
  const [history, columns, constraints] = await adapter.readOnly([
    historyQuery,
    columnsQuery,
    constraintsQuery,
  ]);
  const applied = [
    ...METER_PRIOR_HISTORY,
    [METER_MIGRATION_SHA, String(METER_MIGRATION_TIME)],
  ];
  if (sameHistory(history, applied)) {
    verifyMeterTable(columns, constraints);
    return {
      state: "already-applied" as const,
      migrationSha256: METER_MIGRATION_SHA,
    };
  }
  if (!sameHistory(history, METER_PRIOR_HISTORY))
    fail(
      "Migration history is not exactly the verified0000–0005 baseline. Stop for review.",
    );
  if (columns.length || constraints.length)
    fail("An untracked meter table already exists. Stop for review.");
  return {
    state: "ready-to-apply" as const,
    migrationSha256: METER_MIGRATION_SHA,
  };
}
export async function applyMeterMigration(
  adapter: MigrationAdapter,
  migration: string,
  approvalId: string,
) {
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{7,199}$/.test(approvalId))
    fail("An explicit human approval identity is required to apply0006.");
  const preflight = await preflightMeterMigration(adapter, migration);
  if (preflight.state === "already-applied")
    return {
      state: "already-applied" as const,
      migrationSha256: METER_MIGRATION_SHA,
    };
  const prior = JSON.stringify(METER_PRIOR_HISTORY);
  await adapter.atomic([
    { text: "SELECT pg_advisory_xact_lock(902610110006)" },
    {
      text: "LOCK TABLE drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE",
    },
    {
      text: `DO $meter_guard$ BEGIN
      IF (SELECT jsonb_agg(jsonb_build_array(hash,created_at::text) ORDER BY created_at,id) FROM drizzle.__drizzle_migrations)
        IS DISTINCT FROM '${prior}'::jsonb THEN RAISE EXCEPTION 'Meter migration history changed'; END IF;
      IF to_regclass('public.openai_meter_observations') IS NOT NULL THEN RAISE EXCEPTION 'Meter table appeared after preflight'; END IF;
    END $meter_guard$`,
    },
    { text: migration },
    {
      text: "INSERT INTO drizzle.__drizzle_migrations (hash,created_at) VALUES ($1,$2)",
      values: [METER_MIGRATION_SHA, METER_MIGRATION_TIME],
    },
  ]);
  const after = await preflightMeterMigration(adapter, migration);
  if (after.state !== "already-applied")
    fail("Meter migration verification failed. Do not enable AI.");
  return { state: "applied" as const, migrationSha256: METER_MIGRATION_SHA };
}
