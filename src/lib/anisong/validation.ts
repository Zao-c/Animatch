import { AppError } from "@/lib/app-error";
import { SONG_KINDS, type SongTrack } from "./types";

export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("请求格式不正确", 400);
  return value as Record<string, unknown>;
}
export function textInput(value: unknown, label: string, max = 120, required = false): string {
  if (value != null && typeof value !== "string") throw new AppError(`${label}格式不正确`, 400);
  const text = typeof value === "string" ? value.trim() : "";
  if ((required && !text) || text.length > max) throw new AppError(`${label}需为${required ? "1" : "0"}–${max}个字符`, 400);
  return text;
}
function numberInput(value: unknown, min: number, max: number, fallback: number | null): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "number" && typeof value !== "string") throw new AppError("数字格式不正确", 400);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new AppError(`数字需在 ${min}–${max} 之间`, 400);
  return n;
}
export function revisionInput(value: unknown): number {
  const n = numberInput(value, 1, Number.MAX_SAFE_INTEGER, null);
  if (n === null || !Number.isInteger(n)) throw new AppError("缺少有效的保存版本，请刷新页面", 400);
  return n;
}
export function audioUrlInput(value: unknown): string {
  const raw = textInput(value, "音频地址", 2048);
  if (!raw) return "";
  let url: URL;
  try { url = new URL(raw); } catch { throw new AppError("请填写 HTTPS 音频直链", 400); }
  // Audio is streamed by the browser, never fetched or proxied by our server.
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
    !url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname) ||
    url.hostname.endsWith(".local") || url.hostname.includes(":")) throw new AppError("请使用公开的 HTTPS 音频直链", 400);
  return url.href;
}
export function trackInput(value: unknown): Omit<SongTrack, "id" | "source"> {
  const input = objectInput(value);
  const kind = input.kind ?? "OP";
  if (!SONG_KINDS.includes(kind as SongTrack["kind"])) throw new AppError("歌曲类型不正确", 400);
  const year = numberInput(input.year, 1900, 2100, null);
  const quarter = numberInput(input.quarter, 1, 4, null);
  if ((year !== null && !Number.isInteger(year)) || (quarter !== null && !Number.isInteger(quarter))) throw new AppError("年份和季度需为整数", 400);
  const tags = textInput(input.tags, "风格标签", 160).split(/[,，]/).map(t => t.trim()).filter(Boolean);
  if (tags.length > 8 || tags.some(t => t.length > 20)) throw new AppError("最多8个标签，每个不超过20字", 400);
  return { title: textInput(input.title, "歌名", 120, true), artist: textInput(input.artist, "歌手"),
    anime: textInput(input.anime, "动画"), kind: kind as SongTrack["kind"], year, quarter, tags: [...new Set(tags)],
    clipStart: numberInput(input.clipStart, 0, 3600, 0)!, clipLength: numberInput(input.clipLength, 5, 90, 30)! };
}
