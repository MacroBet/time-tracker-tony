import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(
  password: string,
  encoded?: string | null,
) {
  const [, salt, hash] = (encoded || "").split(":");
  const key = (await scrypt(
    password,
    salt || "invalid-account-timing-padding",
    64,
  )) as Buffer;
  const expected = Buffer.from(hash || "", "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}
