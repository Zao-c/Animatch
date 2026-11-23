import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch } from "undici";
import { AppError } from "@/lib/app-error";
import { MAX_AUDIO_BYTES } from "../types";

export function publicAudioHost(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError("音频直链无效", 400); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port || isIP(host) || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) throw new AppError("音频入池只接受公开 HTTPS 地址", 400);
  if (["apple.com", "itunes.apple.com", "mzstatic.com"].some(domain => host === domain || host.endsWith(`.${domain}`))) throw new AppError("iTunes 素材只做外部试听，不下载到公共音频池", 400);
  return url;
}
export function publicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export async function downloadPublicAudio(value: string): Promise<Uint8Array> {
  const signal = AbortSignal.timeout(20000);
  let current = publicAudioHost(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const addresses = await lookup(current.hostname, { all: true, family: 4 });
    if (!addresses.length || addresses.some(entry => !publicIPv4(entry.address))) throw new AppError("音频地址解析到了受限网络", 400);
    const pinned = addresses[0];
    // Pin the validated DNS result to this connection, including every redirect.
    const dispatcher = new Agent({ connect: { lookup: (_hostname, options, callback) => {
      if (options.all) callback(null, [pinned]); else callback(null, pinned.address, 4);
    } } });
    try {
      const response = await fetch(current, { dispatcher, signal, redirect: "manual", headers: { "User-Agent": "AniMatch/1.0 audio-library", "Accept": "audio/*,application/octet-stream" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location"); await response.body?.cancel();
        if (!location) throw new AppError("音频地址跳转无效", 422);
        current = publicAudioHost(new URL(location, current).href); continue;
      }
      if (!response.ok || !response.body) throw new AppError("音频下载失败，请上传本地文件补充", 422);
      if (Number(response.headers.get("content-length")) > MAX_AUDIO_BYTES) { await response.body.cancel(); throw new AppError("音频超过20 MB，无法入池", 413); }
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const { done, value: bytes } = await reader.read(); if (done) break;
          size += bytes.byteLength; if (size > MAX_AUDIO_BYTES) { await reader.cancel(); throw new AppError("音频超过20 MB，无法入池", 413); } chunks.push(bytes);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return bytes;
    } finally { await dispatcher.close(); }
  }
  throw new AppError("音频地址跳转过多", 422);
}
