import { fetch, type Dispatcher } from "undici";
import { getDispatcher } from "@/lib/server/outbound-fetch";
import { AppError } from "@/lib/app-error";
import type { ItunesReference } from "../types";
export type ItunesSong = { reference: ItunesReference; album: string; coverUrl: string | null; hasPreview: boolean };
type ItunesItem = ItunesSong & { previewUrl: string | null };
const cache = new Map<string, { until: number; value: ItunesItem[] }>();
const pending = new Map<string, Promise<ItunesItem[]>>();
let windowStart = 0, calls = 0;
export function itunesId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{0,15}$/.test(value)) throw new AppError("iTunes 歌曲编号无效", 400);
  return value;
}
export function itunesCountry(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{2}$/.test(value)) throw new AppError("iTunes 商店地区无效", 400);
  return value;
}
function appleUrl(value: unknown, domains: string[]): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.port && !url.username && !url.password && domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ? url.href : null; }
  catch { return null; }
}
export function normalizeItunes(item: Record<string, unknown>, country: string): ItunesItem | null {
  if (item.kind !== "song" || !Number.isSafeInteger(item.trackId) || Number(item.trackId) <= 0) return null;
  const storeUrl = appleUrl(item.trackViewUrl, ["music.apple.com", "itunes.apple.com"]);
  if (!storeUrl) return null;
  const previewUrl = appleUrl(item.previewUrl, ["itunes.apple.com", "mzstatic.com"]);
  return { reference: { id: String(item.trackId), country, title: String(item.trackName || "未命名歌曲").slice(0, 120), artist: String(item.artistName || "").slice(0, 120), storeUrl }, album: String(item.collectionName || "").slice(0, 120), coverUrl: appleUrl(item.artworkUrl100, ["mzstatic.com"]), hasPreview: Boolean(previewUrl), previewUrl };
}
async function requestItunes(path: "search" | "lookup", params: Record<string, string>, country: string): Promise<ItunesItem[]> {
  const url = new URL(`https://itunes.apple.com/${path}`);
  for (const [key, value] of Object.entries({ ...params, country })) url.searchParams.set(key, value);
  const key = url.href; const now = Date.now();
  const saved = cache.get(key); if (saved && saved.until > now) return saved.value;
  const active = pending.get(key); if (active) return active;
  if (now - windowStart >= 60000) { windowStart = now; calls = 0; }
  if (++calls > 18) throw new AppError("iTunes 请求较多，请稍后重试或使用公共音频池", 429);
  const operation = (async () => {
    try {
      const dispatcher = await getDispatcher(url.href);
      const response = await fetch(url, { ...(dispatcher ? { dispatcher: dispatcher as Dispatcher } : {}), signal: AbortSignal.timeout(6500), redirect: "error", headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("upstream status");
      const json = await response.json() as { results?: Record<string, unknown>[] };
      if (!Array.isArray(json.results)) throw new Error("invalid response");
      const items = json.results.slice(0, 25).map(item => normalizeItunes(item, country)).filter((item): item is ItunesItem => item !== null);
      for (const [key, entry] of cache) if (entry.until <= now) cache.delete(key);
      if (cache.size >= 256) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + 10 * 60000, value: items }); return items;
    } catch { throw new AppError("iTunes 暂时无法连接，请稍后重试或使用公共音频池", 502); }
  })();
  pending.set(key, operation);
  try { return await operation; } finally { pending.delete(key); }
}
export async function searchItunes(query: string, country: string): Promise<ItunesSong[]> {
  return (await requestItunes("search", { term: query, media: "music", entity: "song", limit: "20" }, itunesCountry(country))).map(({ previewUrl: _preview, ...item }) => item);
}
export async function lookupItunes(id: string, country: string) {
  const items = await requestItunes("lookup", { id: itunesId(id), entity: "song" }, itunesCountry(country));
  const song = items.find(item => item.reference.id === id);
  if (!song) throw new AppError("此地区找不到对应 iTunes 歌曲，请重新匹配版本", 404);
  return song;
}
