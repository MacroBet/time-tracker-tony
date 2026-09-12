import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
let instance: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return (instance ??= drizzle(neon(url), { schema }));
}
