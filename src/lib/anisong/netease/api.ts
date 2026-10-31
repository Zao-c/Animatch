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
  const fallback = "可继续使用 iTunes、公共音频池或本地音频。";
  if (!base) throw new AppError(`网易云服务尚未配置。${fallback}`, 503, "NETEASE_UNCONFIGURED");
  let url: URL;
  try {
    const endpoint = new URL(base);
    if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error();
    url = new URL(path, endpoint);
  } catch { throw new AppError(`网易云服务地址配置无效。${fallback}`, 503, "NETEASE_CONFIGURATION"); }
  let response: Response;
  let data: Record<string, any>;
  try {
    // Include body consumption in the deadline; slow response bodies must also abort.
    url.searchParams.set("timestamp", String(Date.now()));
    url.searchParams.set("requestId", randomUUID());
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, cookie, unblock: "false" }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      await response.body?.cancel();
      if ([401, 403].includes(response.status)) throw new AppError(`网易云服务拒绝访问，请检查账号权限或地区限制。${fallback}`, 503, "NETEASE_ACCESS");
      if (response.status === 429) throw new AppError(`网易云请求过于频繁，请稍后重试。${fallback}`, 503, "NETEASE_RATE_LIMIT");
      throw new AppError(`网易云上游服务返回 HTTP ${response.status}，暂时不可用。${fallback}`, 502, "NETEASE_HTTP");
    }
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SyntaxError();
    data = value as Record<string, any>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof SyntaxError) throw new AppError(`网易云服务返回的数据格式异常。${fallback}`, 502, "NETEASE_JSON");
    const failure = error as { name?: string; cause?: { code?: string } };
    if (["TimeoutError", "AbortError"].includes(failure?.name ?? "")) throw new AppError(`网易云服务响应超时，请稍后重试。${fallback}`, 504, "NETEASE_TIMEOUT");
    if (["ENOTFOUND", "EAI_AGAIN"].includes(failure?.cause?.code ?? "")) throw new AppError(`网易云服务地址无法解析，请管理员检查服务地址及 Docker 网络。${fallback}`, 503, "NETEASE_DNS");
    if (["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"].includes(failure?.cause?.code ?? "")) throw new AppError(`无法连接网易云服务，请管理员检查服务容器、端口及网络。${fallback}`, 503, "NETEASE_CONNECTION");
    throw new AppError(`网易云服务连接失败，请稍后重试。${fallback}`, 502, "NETEASE_NETWORK");
  }
  if ([301, 302, 401, 403].includes(data.code)) throw new AppError(`网易云需要重新登录或当前账号、地区无访问权限。${fallback}`, 503, "NETEASE_ACCESS");
  if ([429, 460].includes(data.code)) throw new AppError(`网易云请求受限，请稍后重试。${fallback}`, 503, "NETEASE_RATE_LIMIT");
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
  if (!data.result || (data.result.songs !== undefined && !Array.isArray(data.result.songs))) throw new AppError("网易云搜索返回的数据格式异常，可继续使用其他音源。", 502, "NETEASE_JSON");
  return (data.result.songs ?? []).slice(0, 20).map(normalizeNeteaseSong) as NeteaseSong[];
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
