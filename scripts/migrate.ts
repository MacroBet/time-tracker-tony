import { migrate } from "drizzle-orm/neon-http/migrator";
import { scriptDb } from "./env";
try {
  await migrate(scriptDb(), { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied.");
} catch {
  console.error(
    "Migration failed. Check your Neon connection and database permissions. No credentials are printed.",
  );
  process.exitCode = 1;
}
