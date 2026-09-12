import { createDemoData } from "../src/lib/demo-data";
import * as schema from "../src/server/db/schema";
import { scriptDb } from "./env";
if (!process.argv.includes("--demo")) {
  console.error(
    "Synthetic data only. Use npm run db:seed -- --demo on a dedicated Neon test branch.",
  );
  process.exit(1);
}
try {
  const db = scriptDb();
  const data = createDemoData();
  await db.batch([
    db.insert(schema.companies).values(data.companies).onConflictDoNothing(),
    db.insert(schema.users).values(data.users).onConflictDoNothing(),
    db.insert(schema.projects).values(data.projects).onConflictDoNothing(),
    db
      .insert(schema.memberships)
      .values(data.memberships)
      .onConflictDoNothing(),
    db.insert(schema.tasks).values(data.tasks).onConflictDoNothing(),
    db.insert(schema.shifts).values(data.shifts).onConflictDoNothing(),
    db.insert(schema.activities).values(data.activities).onConflictDoNothing(),
  ]);
  console.log(
    "Synthetic sample data added. Existing rows were not overwritten. Set individual passwords with db:set-password.",
  );
} catch {
  console.error(
    "Seeding failed. Check the connection, migrations and target test branch.",
  );
  process.exitCode = 1;
}
