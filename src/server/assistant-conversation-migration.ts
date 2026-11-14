import { createHash } from "node:crypto";
import {
  METER_MIGRATION_SHA,
  METER_MIGRATION_TARGET,
  METER_MIGRATION_TIME,
  METER_PRIOR_HISTORY,
  assertVercelMeterMigrationContext,
  type MigrationAdapter,
  type MigrationQuery,
} from "./openai-meter-migration";

export const CHAT_MIGRATION_SHA =
  "61f56fda1caa931116e3584611b237d0e00e33396145e3d7680026317a5dc14b";
export const CHAT_MIGRATION_TIME = 1794672000000;
export const CHAT_MIGRATION_TARGET = METER_MIGRATION_TARGET;
export const CHAT_PRIOR_HISTORY = [
  ...METER_PRIOR_HISTORY,
  [METER_MIGRATION_SHA, String(METER_MIGRATION_TIME)],
] as const;
const fail = (message: string): never => {
  throw new Error(message);
};
export function assertChatMigrationApproval(
  environment: Record<string, string | undefined>,
  approvalId: string,
) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,199}$/u.test(approvalId) ||
    environment.FIELDTRACK_CHAT_MIGRATION_APPROVAL !== approvalId
  )
    fail(
      "Assistant conversation apply requires its matching explicit human approval identity.",
    );
}
/** The production project is shared with meter; approval identities are not. */
export function assertVercelChatMigrationContext(
  environment: Record<string, string | undefined>,
  target = CHAT_MIGRATION_TARGET,
  applyApprovalId?: string,
) {
  assertVercelMeterMigrationContext(environment, target);
  if (applyApprovalId !== undefined)
    assertChatMigrationApproval(environment, applyApprovalId);
}
export function assertAssistantConversationMigrationSql(migration: string) {
  if (
    createHash("sha256").update(migration).digest("hex") !== CHAT_MIGRATION_SHA
  )
    fail(
      "Assistant conversation migration checksum does not match the approved exact0007 file.",
    );
}

const historyQuery: MigrationQuery = {
  text: "SELECT hash,created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY created_at,id",
};
const columnsQuery: MigrationQuery = {
  text: "SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='assistant_conversations' ORDER BY ordinal_position",
};
// PG18 exposes NOT NULL constraints here; column nullability verifies them on
// all supported PostgreSQL versions, so compare only the other constraints.
const constraintsQuery: MigrationQuery = {
  text: "SELECT conname,contype::text AS contype,pg_get_constraintdef(oid) AS definition,convalidated FROM pg_constraint WHERE conrelid=to_regclass('public.assistant_conversations') AND contype<>'n' ORDER BY conname",
};
const indexesQuery: MigrationQuery = {
  text: "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='assistant_conversations' ORDER BY indexname",
};
const tableQuery: MigrationQuery = {
  text: "SELECT relkind::text AS kind,relrowsecurity,relforcerowsecurity,relacl::text AS privileges FROM pg_class WHERE oid=to_regclass('public.assistant_conversations')",
};
const baselineQuery: MigrationQuery = {
  text: `SELECT (
  to_regclass('public.users') IS NOT NULL AND to_regclass('public.projects') IS NOT NULL AND
  to_regclass('public.project_memberships') IS NOT NULL AND to_regclass('public.tasks') IS NOT NULL AND
  to_regclass('public.openai_meter_observations') IS NOT NULL AND
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='modules' AND data_type='jsonb') AND
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role' AND udt_name='role' AND is_nullable='NO')
) AS ready`,
};
const expectedColumns = [
  ["id", "uuid", "NO", null],
  ["user_id", "text", "NO", null],
  ["project_id", "text", "NO", null],
  ["title", "text", "NO", null],
  ["messages", "jsonb", "NO", "'[]'::jsonb"],
  ["report_state", "jsonb", "YES", null],
  ["version", "integer", "NO", "1"],
  ["created_at", "timestamp with time zone", "NO", "now()"],
  ["updated_at", "timestamp with time zone", "NO", "now()"],
].map(([column_name, data_type, is_nullable, column_default]) => ({
  column_name,
  data_type,
  is_nullable,
  column_default,
}));
const expectedConstraints = [
  {
    conname: "assistant_conversations_messages",
    contype: "c",
    definition:
      'CHECK (((jsonb_typeof(messages) = \'array\'::text) AND (jsonb_array_length(messages) <= 200) AND (octet_length((messages)::text) <= 1048576) AND (NOT jsonb_path_exists(messages, \'$[*]?(((((((@.type() != "object" || !(exists (@."id"))) || !(exists (@."role"))) || !(exists (@."text"))) || @."id".type() != "string") || @."text".type() != "string") || exists (@."error") && @."error".type() != "string") || @."role" != "user" && @."role" != "assistant")\'::jsonpath)) AND (NOT jsonb_path_exists(messages, \'$[*].keyvalue()?(((@."key" != "id" && @."key" != "role") && @."key" != "text") && @."key" != "error")\'::jsonpath))))',
    convalidated: true,
  },
  {
    conname: "assistant_conversations_pkey",
    contype: "p",
    definition: "PRIMARY KEY (id)",
    convalidated: true,
  },
  {
    conname: "assistant_conversations_project_id_projects_id_fk",
    contype: "f",
    definition:
      "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE",
    convalidated: true,
  },
  {
    conname: "assistant_conversations_report_scope",
    contype: "c",
    definition:
      "CHECK (((report_state IS NULL) OR ((jsonb_typeof(report_state) = 'object'::text) AND ((report_state ->> 'projectId'::text) IS NOT NULL) AND ((report_state ->> 'projectId'::text) = project_id))))",
    convalidated: true,
  },
  {
    conname: "assistant_conversations_title",
    contype: "c",
    definition:
      "CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)))",
    convalidated: true,
  },
  {
    conname: "assistant_conversations_user_id_users_id_fk",
    contype: "f",
    definition: "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
    convalidated: true,
  },
  {
    conname: "assistant_conversations_version",
    contype: "c",
    definition: "CHECK ((version > 0))",
    convalidated: true,
  },
];
const expectedIndexes = [
  {
    indexname: "assistant_conversations_owner_project_updated_idx",
    indexdef:
      "CREATE INDEX assistant_conversations_owner_project_updated_idx ON public.assistant_conversations USING btree (user_id, project_id, updated_at DESC, id DESC)",
  },
  {
    indexname: "assistant_conversations_pkey",
    indexdef:
      "CREATE UNIQUE INDEX assistant_conversations_pkey ON public.assistant_conversations USING btree (id)",
  },
];
const expectedTable = [
  {
    kind: "r",
    relrowsecurity: false,
    relforcerowsecurity: false,
    privileges: null,
  },
];
const same = (actual: unknown, expected: unknown) =>
  JSON.stringify(actual) === JSON.stringify(expected);
const sameHistory = (
  rows: Record<string, unknown>[],
  expected: readonly (readonly string[])[],
) =>
  same(
    rows.map((row) => [row.hash, String(row.created_at)]),
    expected,
  );
function verifyTable(
  columns: Record<string, unknown>[],
  constraints: Record<string, unknown>[],
  indexes: Record<string, unknown>[],
  table: Record<string, unknown>[],
) {
  if (
    !same(columns, expectedColumns) ||
    !same(constraints, expectedConstraints) ||
    !same(indexes, expectedIndexes) ||
    !same(table, expectedTable)
  )
    fail(
      "Existing assistant conversations table does not match the approved migration shape.",
    );
}

export async function preflightAssistantConversationMigration(
  adapter: MigrationAdapter,
  migration: string,
) {
  assertAssistantConversationMigrationSql(migration);
  const [history, columns, constraints, indexes, table, baseline] =
    await adapter.readOnly([
      historyQuery,
      columnsQuery,
      constraintsQuery,
      indexesQuery,
      tableQuery,
      baselineQuery,
    ]);
  if (baseline[0]?.ready !== true)
    fail(
      "Required existing project, task, user permissions or meter tables are missing. Stop for review.",
    );
  const applied = [
    ...CHAT_PRIOR_HISTORY,
    [CHAT_MIGRATION_SHA, String(CHAT_MIGRATION_TIME)],
  ];
  if (sameHistory(history, applied)) {
    verifyTable(columns, constraints, indexes, table);
    return {
      state: "already-applied" as const,
      migrationSha256: CHAT_MIGRATION_SHA,
    };
  }
  if (!sameHistory(history, CHAT_PRIOR_HISTORY))
    fail(
      "Migration history is not exactly the verified0000–0006 baseline. Stop for review.",
    );
  if (columns.length || constraints.length || indexes.length || table.length)
    fail(
      "An untracked assistant conversations relation already exists. Stop for review.",
    );
  return {
    state: "ready-to-apply" as const,
    migrationSha256: CHAT_MIGRATION_SHA,
  };
}

const literalJson = (value: unknown) =>
  `'${JSON.stringify(value).replace(/'/gu, "''")}'::jsonb`;
function atomicShapeGuard(): MigrationQuery {
  const pairs = [
    [columnsQuery, expectedColumns],
    [constraintsQuery, expectedConstraints],
    [indexesQuery, expectedIndexes],
    [tableQuery, expectedTable],
  ] as const;
  return {
    text: `DO $chat_shape$ BEGIN
${pairs.map(([query, expected]) => `IF (SELECT jsonb_agg(to_jsonb(shape)) FROM (${query.text}) AS shape) IS DISTINCT FROM ${literalJson(expected)} THEN RAISE EXCEPTION 'Assistant conversation migration shape verification failed'; END IF;`).join("\n")}
IF NOT (SELECT ready FROM (${baselineQuery.text}) AS baseline) THEN RAISE EXCEPTION 'Existing permissions or project baseline changed'; END IF;
END $chat_shape$`,
  };
}

export async function applyAssistantConversationMigration(
  adapter: MigrationAdapter,
  migration: string,
  approvalId: string,
) {
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{7,199}$/u.test(approvalId))
    fail("An explicit human approval identity is required to apply0007.");
  const before = await preflightAssistantConversationMigration(
    adapter,
    migration,
  );
  if (before.state === "already-applied") return before;
  const prior = literalJson(CHAT_PRIOR_HISTORY);
  await adapter.atomic([
    { text: "SELECT pg_advisory_xact_lock(902611140007)" },
    {
      text: "LOCK TABLE drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE",
    },
    {
      text: `DO $chat_guard$ BEGIN
IF (SELECT jsonb_agg(jsonb_build_array(hash,created_at::text) ORDER BY created_at,id) FROM drizzle.__drizzle_migrations) IS DISTINCT FROM ${prior} THEN RAISE EXCEPTION 'Assistant conversation migration history changed'; END IF;
IF to_regclass('public.assistant_conversations') IS NOT NULL THEN RAISE EXCEPTION 'Assistant conversations table appeared after preflight'; END IF;
END $chat_guard$`,
    },
    ...migration
      .split("--> statement-breakpoint")
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text })),
    {
      text: "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)",
      values: [CHAT_MIGRATION_SHA, CHAT_MIGRATION_TIME],
    },
    atomicShapeGuard(),
  ]);
  const after = await preflightAssistantConversationMigration(
    adapter,
    migration,
  );
  if (after.state !== "already-applied")
    fail(
      "Assistant conversation migration verification failed. Do not enable persisted chats.",
    );
  return { state: "applied" as const, migrationSha256: CHAT_MIGRATION_SHA };
}
