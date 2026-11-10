import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertVercelMeterMigrationContext } from "../src/server/openai-meter-migration";

/** A missing approval gate is the ordinary build, with no migration connection. */
export function vercelBuildSteps(env: Record<string, string | undefined>) {
  const approval = env.FIELDTRACK_METER_MIGRATION_APPROVAL?.trim();
  const next = ["node_modules/next/dist/bin/next", "build", "--webpack"];
  if (!approval) return [next];
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{7,199}$/.test(approval))
    throw new Error("Invalid meter migration approval identity.");
  assertVercelMeterMigrationContext(env);
  return [
    [
      "--import",
      "tsx",
      "scripts/migrate-openai-meter.ts",
      "--vercel-production",
      "--apply",
      "--approval-id",
      approval,
    ],
    next,
  ];
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    for (const args of vercelBuildSteps(process.env)) {
      const result = spawnSync(process.execPath, args, {
        stdio: "inherit",
        env: process.env,
      });
      if (result.status !== 0) {
        process.exitCode = result.status || 1;
        break;
      }
    }
  } catch {
    console.error(
      "Production meter migration gate refused this build. No migration was started. Verify the exact approved project/environment and approval identity.",
    );
    process.exitCode = 1;
  }
}
