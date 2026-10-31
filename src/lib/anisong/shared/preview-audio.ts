import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const MINIMUM_SAVING_RATIO = 0.9;

export type EncodedSongPreview = { key: string; mime: "audio/mpeg"; bytes: Uint8Array };

/** Make a broadly playable 128 kbps MP3 only when it meaningfully reduces transfer size. */
export async function encodeSongPreview(sourceKey: string, sourceBytes: Uint8Array): Promise<EncodedSongPreview | null> {
  if (!/^[a-f0-9]{64}\.(mp3|m4a|wav|ogg|flac)$/.test(sourceKey) || !sourceBytes.length) return null;
  const directory = await mkdtemp(path.join(os.tmpdir(), "animatch-preview-"));
  const input = path.join(directory, "source.audio");
  const output = path.join(directory, "preview.mp3");
  try {
    await writeFile(input, sourceBytes, { mode: 0o600 });
    await execFile("ffmpeg", [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file", "-i", input,
      "-map", "0:a:0", "-vn", "-sn", "-dn", "-map_metadata", "-1", "-codec:a", "libmp3lame",
      "-b:a", "128k", "-ar", "44100", "-ac", "2", "-f", "mp3", "-y", output
    ], { timeout: 60_000, maxBuffer: 16 * 1024 });
    const bytes = await readFile(output);
    if (!bytes.length || bytes.length >= sourceBytes.length * MINIMUM_SAVING_RATIO) return null;
    const sha256 = sourceKey.slice(0, 64);
    return { key: `${sha256}.preview-v1.mp3`, mime: "audio/mpeg", bytes };
  } catch {
    // Some otherwise playable inputs are unsupported by the installed codecs; keep the original usable.
    return null;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
