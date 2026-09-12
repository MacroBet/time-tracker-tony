import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/server/db/schema";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
export function scriptDb() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "Set DATABASE_URL in .env.local before running this command.",
    );
  return drizzle(neon(url), { schema });
}
