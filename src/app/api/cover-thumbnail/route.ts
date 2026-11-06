import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { GET as getCachedProxyImage } from "@/app/api/image-proxy/route";
import {
  getAnimeCoverUploadDir,
  getCustomItemUploadDir,
  isLocalAnimeCoverPath,
  isLocalCustomItemPath
} from "@/lib/anime-cover-upload";
import { generateSmartCover, SMART_COVER_VERSION } from "@/lib/server/smart-cover-thumbnail";
import type { SmartCoverVariant } from "@/lib/smart-cover-url";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const CACHE_DIR = process.env.ANIMATCH_SMART_COVER_CACHE_DIR ??
  path.join(process.cwd(), "data", "smart-cover-cache");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

// Coalesce repeated requests for the same source and bound Sharp CPU usage.
const inflight = new Map<string, Promise<Buffer>>();
const queue: Array<() => void> = [];
let activeTransforms = 0;

async function withTransformSlot<T>(job: () => Promise<T>): Promise<T> {
  if (activeTransforms >= 2) {
    if (queue.length >= 250) throw new Error("Thumbnail queue is full");
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  activeTransforms++;
  try {
    return await job();
  } finally {
    activeTransforms--;
    queue.shift()?.();
  }
}

function imageResponse(buffer: Buffer) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function loadSource(src: string, request: Request): Promise<Buffer> {
  let filePath: string | null = null;
  if (isLocalAnimeCoverPath(src)) {
    filePath = path.join(getAnimeCoverUploadDir(), src.slice("/uploads/anime-covers/".length));
  } else if (isLocalCustomItemPath(src)) {
    filePath = path.join(getCustomItemUploadDir(), src.slice("/uploads/custom-items/".length));
  }

  if (filePath !== null) {
    const fileInfo = await stat(filePath);
    if (fileInfo.size > MAX_SOURCE_BYTES) throw new Error("Image is too large");
    return readFile(filePath);
  }

  // Reuse the image proxy's host allowlist, DNS/IP checks, redirect validation,
  // bounded fetching and disk cache. Never fetch an unchecked client URL.
  const proxyUrl = new URL("/api/image-proxy", request.url);
  proxyUrl.searchParams.set("url", src);
  const response = await getCachedProxyImage(new Request(proxyUrl));
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error("Cover image source is unavailable");
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("Image is too large");
  return Buffer.from(bytes);
}

async function readFreshThumbnail(filePath: string): Promise<Buffer | null> {
  try {
    const fileInfo = await stat(filePath);
    if (Date.now() - fileInfo.mtimeMs > CACHE_TTL_MS) return null;
    return await readFile(filePath);
  } catch {
    return null;
  }
}

async function buildAndCache(key: string, src: string, variant: SmartCoverVariant, request: Request) {
  const filePath = path.join(CACHE_DIR, `${key}.webp`);
  const cached = await readFreshThumbnail(filePath);
  if (cached !== null) return cached;

  return withTransformSlot(async () => {
    // Another request may have finished while this one was queued.
    const cachedAfterQueue = await readFreshThumbnail(filePath);
    if (cachedAfterQueue !== null) return cachedAfterQueue;

    const input = await loadSource(src, request);
    const result = await generateSmartCover(input, variant);
    await mkdir(CACHE_DIR, { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, result);
      await rename(temporaryPath, filePath);
    } finally {
      await unlink(temporaryPath).catch(() => undefined);
    }
    return result;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get("src")?.trim() ?? "";
  const variant = searchParams.get("variant");
  if (variant !== "card" && variant !== "tier") {
    return NextResponse.json({ error: "Invalid thumbnail variant" }, { status: 400 });
  }
  const local = isLocalAnimeCoverPath(src) || isLocalCustomItemPath(src);
  let remote = false;
  try {
    const parsed = new URL(src);
    remote = (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      !parsed.username && !parsed.password;
  } catch {
    // Local upload paths are handled separately.
  }
  if ((!local && !remote) || src.length > 4096) {
    return NextResponse.json({ error: "Invalid image source" }, { status: 400 });
  }

  const key = createHash("sha256")
    .update(`${SMART_COVER_VERSION}\0${variant}\0${src}`)
    .digest("hex");

  const existing = inflight.get(key);
  if (existing) {
    try { return imageResponse(await existing); }
    catch { return NextResponse.json({ error: "Thumbnail unavailable" }, { status: 502 }); }
  }

  const promise = buildAndCache(key, src, variant, request);
  inflight.set(key, promise);
  try {
    return imageResponse(await promise);
  } catch (error) {
    console.warn("Unable to generate cover thumbnail", error);
    return NextResponse.json({ error: "Thumbnail unavailable" }, {
      status: 502,
      headers: { "Cache-Control": "no-store" }
    });
  } finally {
    inflight.delete(key);
  }
}
