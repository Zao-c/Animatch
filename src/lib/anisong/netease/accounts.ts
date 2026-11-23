import { createHash, randomBytes, createCipheriv, createDecipheriv, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/app-error";
import { neteaseEnabled, neteaseRequest } from "./api";
import type { NeteaseAccount } from "./types";

type Account = { cookie?: string; nickname?: string; pending?: { key: string; expiresAt: number } };
function key() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new AppError("网易云登录存储未配置", 503);
  return createHash("sha256").update(`anisong-netease:${secret}`).digest();
}
function file(userId: string) {
  return path.join(process.env.NETEASE_ACCOUNT_DIR || path.join(process.cwd(), "data/netease-accounts"), `${createHash("sha256").update(userId).digest("hex")}.json`);
}
export async function readNeteaseAccount(userId: string): Promise<Account> {
  try {
    const bytes = Buffer.from(await readFile(file(userId), "utf8"), "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(userId)); decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new AppError("无法读取网易云登录状态，请检查登录存储和 AUTH_SECRET 配置", 503);
  }
}
async function save(userId: string, value: Account) {
  const target = file(userId); await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"), { mode: 0o600 });
  await rename(temporary, target);
}
// Serialize QR creation/poll/disconnect so a late poll cannot undo disconnect.
const locks = new Map<string, Promise<unknown>>();
export async function accountOperation<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation); locks.set(userId, next);
  try { return await next; } finally { if (locks.get(userId) === next) locks.delete(userId); }
}
export async function accountStatus(userId: string): Promise<NeteaseAccount> {
  if (!neteaseEnabled()) return { enabled: false, connected: false };
  const account = await readNeteaseAccount(userId);
  if (!account.cookie) return { enabled: true, connected: false };
  const response = await neteaseRequest("/login/status", {}, account.cookie);
  const profile = response.data?.profile;
  return { enabled: true, connected: Boolean(profile?.userId), ...(profile?.userId ? { nickname: String(profile.nickname || "已登录用户") } : { message: "网易云登录已过期，请重新扫码" }) };
}
export async function startNeteaseLogin(userId: string) {
  const account = await readNeteaseAccount(userId);
  if (account.pending && account.pending.expiresAt - Date.now() > 150000) throw new AppError("二维码刚刚生成，请稍后再刷新", 429);
  const result = await neteaseRequest("/login/qr/key");
  const key = result.data?.unikey;
  if (typeof key !== "string" || !key) throw new AppError("无法生成网易云二维码，请重试", 502);
  const qr = await neteaseRequest("/login/qr/create", { key, qrimg: true });
  const image = qr.data?.qrimg;
  if (typeof image !== "string" || !image.startsWith("data:image/png;base64,") || image.length > 200000) throw new AppError("网易云二维码返回异常", 502);
  const expiresAt = Date.now() + 180000;
  await save(userId, { ...account, pending: { key, expiresAt } });
  return { image, expiresAt };
}
export async function pollNeteaseLogin(userId: string) {
  const account = await readNeteaseAccount(userId);
  if (!account.pending || account.pending.expiresAt <= Date.now()) return { state: "expired" as const };
  const result = await neteaseRequest("/login/qr/check", { key: account.pending.key });
  if (result.code === 803) {
    if (typeof result.cookie !== "string" || !result.cookie.includes("MUSIC_U=") || result.cookie.length > 32000) throw new AppError("网易云没有返回有效登录凭据，请重新扫码", 502);
    // The credential stays encrypted on the server, never in the API response.
    await save(userId, { cookie: result.cookie });
    return { state: "connected" as const };
  }
  if (result.code === 800) { await save(userId, { cookie: account.cookie }); return { state: "expired" as const }; }
  if (result.code === 801 || result.code === 802) return { state: result.code === 802 ? "confirm" as const : "waiting" as const };
  throw new AppError("无法检查扫码状态，请稍后重试", 502);
}
export async function disconnectNetease(userId: string) { await save(userId, {}); return { disconnected: true }; }
