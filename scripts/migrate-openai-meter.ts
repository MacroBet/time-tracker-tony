import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import {
  METER_MIGRATION_TARGET,
  assertMeterMigrationTarget,
  assertVercelMeterMigrationContext,
  preflightMeterMigration,
  applyMeterMigration,
  type MigrationAdapter,
} from "../src/server/openai-meter-migration";

try {
  const args = process.argv.slice(2),
    options = new Map<string, string>();
  let apply = false;
  let vercelProduction = false;
  const allowed = new Set([
    "--expected-host",
    "--expected-database",
    "--connection",
    "--target",
    "--approval-id",
  ]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
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
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw new Error();
    options.set(key, args[++i]);
  }
  const approvalId = options.get("--approval-id") || "";
  if (apply && !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,199}$/.test(approvalId))
    throw new Error();
  let connectionName = "DATABASE_URL";
  if (vercelProduction) {
    if (
      ["--expected-host", "--expected-database", "--connection"].some((key) =>
        options.has(key),
      )
    )
      throw new Error();
    // Runs before neon() is constructed; never import local DB configuration here.
    assertVercelMeterMigrationContext(
      process.env,
      options.get("--target") || METER_MIGRATION_TARGET,
      apply ? approvalId : undefined,
    );
  } else {
    // Only this repository's existing DB configuration. No output of values or URL.
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
      options.get("--target") || METER_MIGRATION_TARGET,
    );
  }
  const connection = process.env[connectionName] || "";
  const migration = await readFile(
    new URL("../drizzle/0006_openai_meter_observations.sql", import.meta.url),
    "utf8",
  );
  const sql = neon(connection, {
    fetchOptions: { signal: AbortSignal.timeout(15000) },
  });
  const adapter: MigrationAdapter = {
    readOnly: (queries) =>
      sql.transaction(
        queries.map((q) => sql.query(q.text, q.values)),
        { readOnly: true, isolationLevel: "RepeatableRead" },
      ) as Promise<Record<string, unknown>[][]>,
    atomic: (queries) =>
      sql.transaction(
        queries.map((q) => sql.query(q.text, q.values)),
        { isolationLevel: "Serializable" },
      ),
  };
  const result = apply
    ? await applyMeterMigration(adapter, migration, approvalId)
    : await preflightMeterMigration(adapter, migration);
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run-read-only",
      target: METER_MIGRATION_TARGET,
      connectionVariable: connectionName,
      targetGuard: vercelProduction
        ? "vercel-production-project"
        : "exact-host-database",
      ...result,
    }),
  );
} catch {
  console.error(
    "Scoped meter migration stopped. Verify exact approved target,0000–0005 history,0006 checksum and required approval. No credentials or raw database errors are printed. Keep AI disabled until verification succeeds.",
  );
  process.exitCode = 1;
}
