/** Read-only provider probe. Set NETEASE_API_URL explicitly; never prints credentials or media URLs. */
import { lookup } from "node:dns/promises";
import { neteaseRequest, resolveNetease, searchNetease } from "../src/lib/anisong/netease/api";
import { AppError } from "../src/lib/app-error";

async function main() {
  const raw = process.env.NETEASE_API_URL;
  if (!raw) throw new AppError("NETEASE_API_URL is not configured", 503, "NETEASE_UNCONFIGURED");
  const url = new URL(raw);
  if (url.username || url.password) throw new AppError("Credentials in URL are unsupported", 503, "NETEASE_CONFIGURATION");
  try { await lookup(url.hostname); console.log(JSON.stringify({ stage: "dns", ok: true })); }
  catch { console.log(JSON.stringify({ stage: "dns", ok: false })); }
  // Anonymous requests only. Does not read account storage or environment cookies.
  const songs = await searchNetease("YOASOBI 夜に駆ける", "");
  console.log(JSON.stringify({ stage: "search", count: songs.length }));
  if (!songs.length) return;
  await neteaseRequest("/song/detail", { ids: songs[0].id });
  const playback = await resolveNetease(songs[0].id, "");
  const response = await fetch(playback.url, { headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(12000) });
  console.log(JSON.stringify({ stage: "audio", http: response.status, type: response.headers.get("content-type"), trial: playback.trial }));
  await response.body?.cancel();
  if (!response.ok) process.exitCode = 1;
}
main().catch(error => {
  // Deliberately omit upstream error bodies, causes, URLs, and arbitrary messages.
  console.log(JSON.stringify({ stage: "failure", code: error instanceof AppError ? error.code : "PROBE_FAILED", status: error instanceof AppError ? error.statusCode : undefined }));
  process.exitCode = 1;
});
