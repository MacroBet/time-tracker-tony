import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import {
  assertMeterMigrationTarget,
  type MigrationAdapter,
} from "../src/server/openai-meter-migration";
import {
  CHAT_MIGRATION_TARGET,
  assertChatMigrationApproval,
  assertVercelChatMigrationContext,
  preflightAssistantConversationMigration,
  applyAssistantConversationMigration,
} from "../src/server/assistant-conversation-migration";

try {
  const args = process.argv.slice(2);
  const options = new Map<string, string>();
  let apply = false;
  let vercelProduction = false;
  const allowed = new Set([
    "--expected-host",
    "--expected-database",
    "--connection",
    "--target",
    "--approval-id",
  ]);
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--vercel-production") {
      if (vercelProduction) throw new Error();
      vercelProduction = true;
      continue;
    }
    if (key === "--apply") {
      if (apply) throw new Error();
      apply = true;
      continue;
    }
    if (
      !allowed.has(key) ||
      options.has(key) ||
      !args[index + 1] ||
      args[index + 1].startsWith("--")
    )
      throw new Error();
    options.set(key, args[++index]);
  }
  const approvalId = options.get("--approval-id");
  // Approval identity is meaningful only alongside an explicit apply operation.
  if (!apply && approvalId !== undefined) throw new Error();
  let connectionName = "DATABASE_URL";
  if (vercelProduction) {
    if (
      ["--expected-host", "--expected-database", "--connection"].some((key) =>
        options.has(key),
      )
    )
      throw new Error();
    // Reuse the exact existing Vercel project check, with a separate chat gate.
    // No dotenv file is read and no connection client exists before this check.
    assertVercelChatMigrationContext(
      process.env,
      options.get("--target") || CHAT_MIGRATION_TARGET,
      apply ? (approvalId ?? "") : undefined,
    );
  } else {
    config({
      path: fileURLToPath(new URL("../.env.local", import.meta.url)),
      quiet: true,
    });
    config({
      path: fileURLToPath(new URL("../.env", import.meta.url)),
      quiet: true,
    });
    connectionName = options.get("--connection") || "DATABASE_URL";
    if (!["DATABASE_URL", "DATABASE_URL_UNPOOLED"].includes(connectionName))
      throw new Error();
    assertMeterMigrationTarget(
      process.env[connectionName] || "",
      options.get("--expected-host") || "",
      options.get("--expected-database") || "",
      options.get("--target") || CHAT_MIGRATION_TARGET,
    );
    if (apply) assertChatMigrationApproval(process.env, approvalId ?? "");
  }
  const migration = await readFile(
    new URL("../drizzle/0007_assistant_conversations.sql", import.meta.url),
    "utf8",
  );
  const sql = neon(process.env[connectionName] || "", {
    fetchOptions: { signal: AbortSignal.timeout(15000) },
  });
  const adapter: MigrationAdapter = {
    readOnly: (queries) =>
      sql.transaction(
        queries.map((query) => sql.query(query.text, query.values)),
        { readOnly: true, isolationLevel: "RepeatableRead" },
      ) as Promise<Record<string, unknown>[][]>,
    atomic: (queries) =>
      sql.transaction(
        queries.map((query) => sql.query(query.text, query.values)),
        { isolationLevel: "Serializable" },
      ),
  };
  const result = apply
    ? await applyAssistantConversationMigration(
        adapter,
        migration,
        approvalId ?? "",
      )
    : await preflightAssistantConversationMigration(adapter, migration);
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run-read-only",
      target: CHAT_MIGRATION_TARGET,
      connectionVariable: connectionName,
      targetGuard: vercelProduction
        ? "vercel-production-project"
        : "exact-host-database",
      ...result,
    }),
  );
} catch {
  console.error(
    "Scoped assistant conversation migration stopped. Verify the exact approved target,0000–0006 history,0007 checksum and separate chat approval. No credentials, chat contents or raw database errors are printed.",
  );
  process.exitCode = 1;
}
