import { readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";

// The endpoint is public, so bound the on-disk cache the way image-proxy does.
// Otherwise anyone could enumerate artwork URLs until the volume fills up.
const DEFAULT_MAX_CACHE_ENTRIES = 5000;
const DEFAULT_MAX_CACHE_BYTES = 512 * 1024 * 1024;
const PRUNE_MIN_INTERVAL_MS = 60 * 1000;
let lastPruneAt = 0;
let pruneInProgress = false;

export function getSmartCoverCacheDir(): string {
  return process.env.ANIMATCH_SMART_COVER_CACHE_DIR ??
    path.join(process.cwd(), "data", "image-cache", "smart-covers");
}

export function smartCoverCacheFilePath(key: string): string {
  return path.join(getSmartCoverCacheDir(), `${key}.webp`);
}

/**
 * Derivatives are immutable for a given key (version + variant + source URL), so
 * they are served until the size-bounded cache evicts them. Bump
 * SMART_COVER_VERSION whenever the rendering algorithm changes.
 */
export async function readCachedSmartCover(filePath: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Evict the least recently written derivatives so the cache volume stays bounded. */
export async function pruneSmartCoverCache(dir: string = getSmartCoverCacheDir()): Promise<void> {
  const maxEntries = parsePositiveInt(
    process.env.ANIMATCH_SMART_COVER_CACHE_MAX_ENTRIES,
    DEFAULT_MAX_CACHE_ENTRIES
  );
  const maxBytes = parsePositiveInt(
    process.env.ANIMATCH_SMART_COVER_CACHE_MAX_BYTES,
    DEFAULT_MAX_CACHE_BYTES
  );

  let names: string[];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    names = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
      .map((entry) => entry.name);
  } catch {
    return;
  }
  if (names.length === 0) return;

  const files: Array<{ filePath: string; size: number; mtimeMs: number }> = [];
  await Promise.all(
    names.map(async (name) => {
      const filePath = path.join(dir, name);
      try {
        const info = await stat(filePath);
        files.push({ filePath, size: info.size, mtimeMs: info.mtimeMs });
      } catch {
        // Evicted or replaced concurrently.
      }
    })
  );
  if (files.length === 0) return;

  files.sort((left, right) => left.mtimeMs - right.mtimeMs);
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let excessEntries = files.length - maxEntries;
  for (const file of files) {
    if (excessEntries <= 0 && totalBytes <= maxBytes) break;
    try {
      await unlink(file.filePath);
      totalBytes -= file.size;
      excessEntries -= 1;
    } catch {
      // Another process may have removed it first.
    }
  }
}

/** Prune opportunistically after a write, at most once per minute per process. */
export function scheduleSmartCoverCachePrune(): void {
  const now = Date.now();
  if (pruneInProgress || now - lastPruneAt < PRUNE_MIN_INTERVAL_MS) return;
  pruneInProgress = true;
  lastPruneAt = now;
  void pruneSmartCoverCache()
    .catch(() => undefined)
    .finally(() => {
      pruneInProgress = false;
    });
}
