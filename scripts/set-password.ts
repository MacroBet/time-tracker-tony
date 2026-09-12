import { eq } from "drizzle-orm";
import { users, sessions } from "../src/server/db/schema";
import { hashPassword } from "../src/lib/password";
import { scriptDb } from "./env";
async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) value += chunk;
    return value.trimEnd();
  }
  process.stdout.write("New password (hidden, at least 12 characters): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", read);
      process.stdout.write("\n");
    };
    const read = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish();
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    process.stdin.on("data", read);
  });
}
try {
  const email = process.argv[2]?.toLowerCase();
  if (!email)
    throw new Error("Usage: npm run db:set-password -- user@example.com");
  const db = scriptDb();
  const user = (
    await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  )[0];
  if (!user) throw new Error("User not found. Provision the user first.");
  const password = await readPassword();
  if (password.length < 12 || password.length > 256)
    throw new Error("Password must contain 12–256 characters.");
  await db.batch([
    db
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, user.id)),
    db.delete(sessions).where(eq(sessions.userId, user.id)),
  ]);
  console.log("Password set; existing sessions revoked.");
} catch (error) {
  console.error(
    error instanceof Error && !("cause" in error)
      ? error.message
      : "Password setup failed. Check the database connection.",
  );
  process.exitCode = 1;
}
