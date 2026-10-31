import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { publicAudioDirectory } from "../src/lib/anisong/shared/audio-pool";
import { cosAudioObjectExists, isCosAudioConfigured, putCosAudioObject } from "../src/lib/anisong/shared/cos-audio";

async function main() {
  if (!isCosAudioConfigured()) throw new Error("ANISONG_COS_* configuration is required");
  const assets = await prisma.songAudioAsset.findMany({ where: { storageProvider: "local" }, orderBy: { createdAt: "asc" } });
  let moved = 0, missing = 0;
  for (const asset of assets) {
    if (!/^[a-f0-9]{64}\.(mp3|m4a|wav|ogg|flac)$/.test(asset.key)) { missing++; continue; }
    const file = path.join(publicAudioDirectory(), asset.key);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile() || info.size !== asset.bytes) { missing++; continue; }
    const bytes = await readFile(file);
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) { missing++; continue; }
    await putCosAudioObject(asset.key, asset.mime, bytes);
    if (!(await cosAudioObjectExists(asset.key))) throw new Error("COS did not confirm uploaded audio");
    await prisma.songAudioAsset.update({ where: { id: asset.id }, data: { storageProvider: "cos" } });
    moved++;
  }
  console.log(JSON.stringify({ scanned: assets.length, moved, missing }));
  if (missing) throw new Error(`${missing} legacy audio files were missing or failed validation; their database storage location was left unchanged`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
