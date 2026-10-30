import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { publicAudioDirectory, storePublicAudio } from "../src/lib/anisong/shared/audio-pool";
import { getCosAudioObject } from "../src/lib/anisong/shared/cos-audio";

async function main() {
  const assets = await prisma.songAudioAsset.findMany({ where: { previewKey: null }, orderBy: { createdAt: "asc" } });
  let scanned = 0, compressed = 0, reusedOriginal = 0;
  for (const asset of assets) {
    scanned++;
    const local = path.join(publicAudioDirectory(), asset.key);
    let bytes: Uint8Array | null = await stat(local).then(info => info.isFile() && info.size === asset.bytes ? readFile(local) : null).catch(() => null);
    if (!bytes && asset.storageProvider === "cos") bytes = await getCosAudioObject(asset.key).catch(() => null);
    if (!bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`Audio asset ${asset.id} failed source integrity validation`);
    const updated = await storePublicAudio(bytes, asset.isPreview);
    if (!updated.previewKey) throw new Error(`Audio asset ${asset.id} did not receive a preview selection`);
    if (updated.previewKey === updated.key) reusedOriginal++; else compressed++;
  }
  console.log(JSON.stringify({ scanned, compressed, reusedOriginal }));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Preview migration failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
