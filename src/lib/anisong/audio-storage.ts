import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile, unlink, stat } from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { AppError } from "@/lib/app-error";
import { MAX_AUDIO_BYTES, type SongSource } from "./types";

export function audioDirectory() { return process.env.ANISONG_AUDIO_DIR || path.join(process.cwd(), "data", "anisong-audio"); }
export function detectAudio(bytes: Uint8Array): { extension: string; mime: string } | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length < 12) return null;
  if (text(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 6) !== 0)) return { extension: "mp3", mime: "audio/mpeg" };
  if (text(0, 4) === "RIFF" && text(8, 12) === "WAVE") return { extension: "wav", mime: "audio/wav" };
  if (text(0, 4) === "OggS") return { extension: "ogg", mime: "audio/ogg" };
  if (text(0, 4) === "fLaC") return { extension: "flac", mime: "audio/flac" };
  if (text(4, 8) === "ftyp" && ["M4A ", "M4B "].includes(text(8, 12))) return { extension: "m4a", mime: "audio/mp4" };
  return null;
}
export async function saveAudio(file: File): Promise<Extract<SongSource, { kind: "upload" }>> {
  if (file.size === 0 || file.size > MAX_AUDIO_BYTES) throw new AppError("音频需在20 MB以内且不能为空", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectAudio(bytes);
  if (!format) throw new AppError("支持 MP3、M4A、WAV、OGG、FLAC 音频，请检查文件格式", 400);
  const key = `${randomUUID()}.${format.extension}`;
  await mkdir(audioDirectory(), { recursive: true });
  await writeFile(path.join(audioDirectory(), key), bytes, { flag: "wx", mode: 0o600 });
  return { kind: "upload", key, mime: format.mime, bytes: bytes.length };
}
export async function discardAudio(key: string) {
  if (/^[a-f0-9-]+\.(mp3|m4a|wav|ogg|flac)$/.test(key)) await unlink(path.join(audioDirectory(), key)).catch(() => {});
}

export function parseAudioRange(header: string | null, size: number): { start: number; end: number } | null {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new AppError("Invalid range", 416);
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new AppError("Invalid range", 416);
  return { start, end };
}
export async function streamAudio(request: Request, source: Extract<SongSource, { kind: "upload" }>, options: { directory?: string; public?: boolean } = {}) {
  if (!/^(?:[a-f0-9]{64}\.preview-v1\.mp3|[a-f0-9-]+\.(?:mp3|m4a|wav|ogg|flac))$/.test(source.key)) throw new AppError("音频不存在", 404);
  const filePath = path.join(options.directory ?? audioDirectory(), source.key);
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) throw new AppError("音频文件不存在，请联系管理员恢复音频备份", 404);
  const headers: Record<string, string> = { "Content-Type": source.mime, "Accept-Ranges": "bytes", "Cache-Control": options.public ? "public, max-age=31536000, immutable" : "private, no-store", "X-Content-Type-Options": "nosniff" };
  let range;
  try { range = parseAudioRange(request.headers.get("range"), info.size); }
  catch { return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${info.size}` } }); }
  headers["Content-Length"] = String(range ? range.end - range.start + 1 : info.size);
  if (range) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${info.size}`;
  const body = request.method === "HEAD" ? null : Readable.toWeb(createReadStream(filePath, range ?? {})) as ReadableStream<Uint8Array>;
  return new Response(body, { status: range ? 206 : 200, headers });
}

// Bound the actual body, including clients omitting Content-Length, before multipart parsing.
export async function boundedBody(request: Request, limit: number): Promise<ArrayBuffer> {
  if (Number(request.headers.get("content-length")) > limit) throw new AppError("上传内容过大", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("请求不能为空", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AppError("上传内容过大", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
export async function songJson(request: Request) {
  const bytes = await boundedBody(request, 128 * 1024);
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new AppError("请求格式不正确", 400); }
}
