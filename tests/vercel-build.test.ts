import test from "node:test";
import assert from "node:assert/strict";
import { vercelBuildSteps } from "../scripts/vercel-build";
const approved = {
  VERCEL_ENV: "production",
  DATABASE_URL: "postgresql://synthetic:synthetic@synthetic.invalid/synthetic",
  VERCEL_PROJECT_ID: "prj_hqtnQUnlqpG0tpjFM49p0Q73m9Vz",
  FIELDTRACK_METER_MIGRATION_APPROVAL: "human-approval-verified",
};
test("ordinary builds never invoke migration without the approval gate", () => {
  for (const env of [
    {},
    { VERCEL_ENV: "production" },
    { ...approved, FIELDTRACK_METER_MIGRATION_APPROVAL: "" },
  ])
    assert.deepEqual(vercelBuildSteps(env), [
      ["node_modules/next/dist/bin/next", "build", "--webpack"],
    ]);
});
test("approved Production build runs only scoped migration before the normal webpack build", () => {
  const steps = vercelBuildSteps(approved);
  assert.deepEqual(steps[0], [
    "--import",
    "tsx",
    "scripts/migrate-openai-meter.ts",
    "--vercel-production",
    "--apply",
    "--approval-id",
    approved.FIELDTRACK_METER_MIGRATION_APPROVAL,
  ]);
  assert.deepEqual(steps[1], [
    "node_modules/next/dist/bin/next",
    "build",
    "--webpack",
  ]);
  for (const env of [
    { ...approved, VERCEL_ENV: "preview" },
    { ...approved, VERCEL_PROJECT_ID: "foreign-project" },
    { ...approved, FIELDTRACK_METER_MIGRATION_APPROVAL: "x" },
  ])
    assert.throws(() => vercelBuildSteps(env));
});
