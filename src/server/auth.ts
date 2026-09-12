import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { dataMode } from "./config";
import * as repo from "./repository";
import { HttpError } from "./errors";
const cookieName = "fieldtrack_session";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function currentUser() {
  if (dataMode() === "unconfigured") return null;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await repo.getSession(digest(token));
  if (!session) return null;
  return (await repo.findUser(session.userId)) ?? null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  return user;
}
export async function signIn(userId: string) {
  await signOut();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 3600000);
  await repo.putSession({
    tokenHash: digest(token),
    userId,
    expiresAt: expiresAt.toISOString(),
  });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
export async function signOut() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && dataMode() !== "unconfigured")
    await repo.deleteSession(digest(token));
  jar.delete(cookieName);
}
