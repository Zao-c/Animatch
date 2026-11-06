import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { GET as getCachedProxyImage } from "@/app/api/image-proxy/route";
import {
  isLocalAnimeCoverPath,
  isLocalCustomItemPath,
  localUploadPublicPathToFilePath
} from "@/lib/anime-cover-upload";
import {
  readCachedSmartCover,
  scheduleSmartCoverCachePrune,
  smartCoverCacheFilePath
} from "@/lib/server/smart-cover-cache";
import { generateSmartCover, SMART_COVER_VERSION } from "@/lib/server/smart-cover-thumbnail";
import type { SmartCoverVariant } from "@/lib/smart-cover-url";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

// Coalesce repeated requests for the same source and bound Sharp CPU usage.
const inflight = new Map<string, Promise<Buffer>>();
const queue: Array<() => void> = [];
let activeTransforms = 0;

async function withTransformSlot<T>(job: () => Promise<T>): Promise<T> {
  if (activeTransforms >= 2) {
    if (queue.length >= 250) throw new Error("Thumbnail queue is full");
    // The previous worker transfers its occupied slot to this waiter.
    await new Promise<void>((resolve) => queue.push(resolve));
  } else {
    activeTransforms++;
  }
  try {
    return await job();
  } finally {
    const next = queue.shift();
    if (next) next();
    else activeTransforms--;
  }
}

function imageResponse(buffer: Buffer) {
  const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function loadSource(src: string, request: Request): Promise<Buffer> {
  const filePath = localUploadPublicPathToFilePath(src);

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

async function buildAndCache(key: string, src: string, variant: SmartCoverVariant, request: Request) {
  const filePath = smartCoverCacheFilePath(key);
  const cached = await readCachedSmartCover(filePath);
  if (cached !== null) return cached;

  return withTransformSlot(async () => {
    // Another request may have finished while this one was queued.
    const cachedAfterQueue = await readCachedSmartCover(filePath);
    if (cachedAfterQueue !== null) return cachedAfterQueue;

    const input = await loadSource(src, request);
    const result = await generateSmartCover(input, variant);
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, result);
      await rename(temporaryPath, filePath);
      scheduleSmartCoverCachePrune();
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
