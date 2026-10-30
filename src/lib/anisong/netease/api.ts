import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/app-error";
import type { NeteasePlayback, NeteaseSong } from "./types";

export function neteaseEnabled() { return Boolean(process.env.NETEASE_API_URL); }
export function neteaseId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{0,17}$/.test(value)) throw new AppError("网易云歌曲编号无效", 400);
  return value;
}
// Only our own server supplies paths and parameters. No generic upstream proxy.
export async function neteaseRequest(path: string, body: Record<string, unknown> = {}, cookie = ""): Promise<Record<string, any>> {
  const base = process.env.NETEASE_API_URL;
  if (!base) throw new AppError("网易云服务尚未配置，请使用本地音频", 503);
  let response: Response;
  try {
    const url = new URL(path, base);
    // The upstream caches requests. Never reuse an authenticated response between users.
    url.searchParams.set("timestamp", String(Date.now()));
    url.searchParams.set("requestId", randomUUID());
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, cookie, unblock: "false" }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
  } catch { throw new AppError("网易云服务连接失败或超时，请稍后重试", 502); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object") throw new AppError("网易云服务暂时不可用，请稍后重试", 502);
  return data;
}
function mediaUrl(value: unknown, audio = false): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const hosts = audio ? ["music.126.net", "music.163.com"] : ["music.126.net"];
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port || !hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
    url.protocol = "https:";
    return url.href;
  } catch { return null; }
}
export function normalizeNeteaseSong(song: Record<string, any>): NeteaseSong {
  const album = song.al ?? song.album ?? {};
  const artists = song.ar ?? song.artists ?? [];
  return { id: neteaseId(String(song.id)), title: String(song.name || "未命名歌曲").slice(0, 120), artist: (Array.isArray(artists) ? artists.map(a => a.name).filter(Boolean).join(" / ") : "").slice(0, 120), album: String(album.name || "").slice(0, 120), coverUrl: mediaUrl(album.picUrl), duration: Math.max(0, Number(song.dt ?? song.duration) || 0), restricted: [1, 4].includes(Number(song.fee)) };
}
export async function searchNetease(query: string, cookie: string) {
  const data = await neteaseRequest("/cloudsearch", { keywords: query, type: 1, limit: 20, offset: 0 }, cookie);
  if (data.code !== 200) throw new AppError("网易云搜索失败，请稍后重试", 502);
  return (Array.isArray(data.result?.songs) ? data.result.songs : []).slice(0, 20).map(normalizeNeteaseSong) as NeteaseSong[];
}
export async function neteaseSong(id: string, cookie: string) {
  const data = await neteaseRequest("/song/detail", { ids: neteaseId(id) }, cookie);
  const song = data.songs?.find((s: { id: unknown }) => String(s.id) === id);
  if (data.code !== 200 || !song) throw new AppError("歌曲不存在或已下架", 404);
  return normalizeNeteaseSong(song);
}
export function normalizePlayback(data: Record<string, any>, id: string): NeteasePlayback {
  const item = Array.isArray(data.data) ? data.data.find((s: { id: unknown }) => String(s.id) === id) : null;
  const url = mediaUrl(item?.url, true);
  if (data.code !== 200 || !url) throw new AppError("这首歌暂时没有可用音源，可能需要登录、购买或受地区限制。可更换版本或上传本地音频。", 422);
  return { url, trial: Boolean(item.freeTrialInfo && item.freeTrialInfo !== "null"), expiresAt: Date.now() + Math.min(300, Math.max(10, Number(item.expi) || 60)) * 1000 };
}
export async function resolveNetease(id: string, cookie: string) {
  return normalizePlayback(await neteaseRequest("/song/url/v1", { id: neteaseId(id), level: "standard" }, cookie), id);
}
