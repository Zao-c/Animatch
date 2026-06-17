import type { NormalizedBangumiSubject } from "@/lib/bangumi";
import type { QuickImportParams } from "./quick-pool-builder";

interface CacheEntry {
  subjects: NormalizedBangumiSubject[];
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function buildCacheKey(params: QuickImportParams): string {
  return JSON.stringify({
    mode: params.mode,
    year: params.year,
    yearFrom: params.yearFrom,
    yearTo: params.yearTo,
    type: params.type,
    tags: params.tags,
    limit: params.limit,
    sort: params.sort,
    bangumiUserId: params.bangumiUserId,
    collectionType: params.collectionType,
  });
}

export function getBangumiSubjectCache(
  params: QuickImportParams
): NormalizedBangumiSubject[] | null {
  const key = buildCacheKey(params);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.subjects;
}

export function setBangumiSubjectCache(
  params: QuickImportParams,
  subjects: NormalizedBangumiSubject[]
): void {
  const key = buildCacheKey(params);
  cache.set(key, {
    subjects,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  if (cache.size > 200) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

export function clearBangumiCache(): void {
  cache.clear();
}
