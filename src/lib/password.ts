import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { AppError } from "./app-error";
const scrypt = promisify(scryptCallback);
export function passwordInput(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) throw new AppError("个人密码需为 8–128 个字符", 400);
  return value;
}
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(passwordInput(value), salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(value: unknown, stored: string) {
  if (typeof value !== "string" || value.length > 128) return false;
  const [version, salt, digest] = stored.split(":");
  if (version !== "scrypt" || !salt || !digest) return false;
  const hash = await scrypt(value, salt, 64) as Buffer, expected = Buffer.from(digest, "hex");
  return expected.length === hash.length && timingSafeEqual(hash, expected);
}
export const recoveryDigest = (value: string) => createHash("sha256").update(value).digest("hex");
