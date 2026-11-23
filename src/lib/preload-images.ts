import type { MatchPair } from "./client-api";
import { getAnimeCoverUrl, getAnimeSourceCoverCandidates, type AnimeCoverUrlFields } from "./anime-cover-url";
import { getCoverDeliveryCandidates } from "./image-proxy";

import { loadCoverImage } from "./cover-loader";

const DEFAULT_PRELOAD_TIMEOUT_MS = 4000;
const inFlightPreloads = new Map<string, Promise<boolean>>();

export function preloadImage(
  src: string | null | undefined,
  options: { timeoutMs?: number } = {}
): Promise<boolean> {
  if (!src) {
    return Promise.resolve(false);
  }

  const existing = inFlightPreloads.get(src);
  if (existing !== undefined) {
    return existing;
  }

  const preload = new Promise<boolean>((resolve) => {
    const image = new Image();
    const timeoutMs = Math.max(1, Math.trunc(options.timeoutMs ?? DEFAULT_PRELOAD_TIMEOUT_MS));
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function finish(result: boolean) {
      if (settled) {
        return;
      }

      settled = true;
      image.onload = null;
      image.onerror = null;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      resolve(result);
    }

    timeout = setTimeout(() => finish(false), timeoutMs);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = src;
  });

  inFlightPreloads.set(src, preload);
  void preload.then(() => {
    inFlightPreloads.delete(src);
  });
  return preload;
}

export async function preloadPair(pair: MatchPair): Promise<boolean> {
  const [leftLoaded, rightLoaded] = await Promise.all([
    preloadAnimeImage(pair.left),
    preloadAnimeImage(pair.right)
  ]);

  return leftLoaded || rightLoaded;
}

export async function preloadPairs(
  pairs: MatchPair[],
  options: { preloadCount?: number; signal?: AbortSignal } = {}
): Promise<{ loaded: number; total: number }> {
  const preloadCount = Math.max(0, Math.trunc(options.preloadCount ?? 4));
  const targetPairs = pairs.slice(0, preloadCount);
  const total = targetPairs.length * 2;

  if (targetPairs.length === 0) {
    return { loaded: 0, total: 0 };
  }

  const results = await Promise.all(
    targetPairs.flatMap((pair) => [
      preloadAnimeImage(pair.left, options.signal),
      preloadAnimeImage(pair.right, options.signal)
    ])
  );

  return {
    loaded: results.filter(Boolean).length,
    total
  };
}

async function preloadAnimeImage(anime: AnimeCoverUrlFields, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  try {
    await loadCoverImage(bestImageCandidates(anime), { signal: signal ?? controller.signal, priority: 2 });
    return true;
  } catch { return false; }
  finally { controller.abort(); }
}

function bestImageCandidates(anime: AnimeCoverUrlFields): string[] {
  const heroUrl = getAnimeCoverUrl(anime, { intent: "hero" });
  const originalSources = getAnimeSourceCoverCandidates(anime);
  return getCoverDeliveryCandidates(heroUrl, originalSources.find((url) => url !== heroUrl), originalSources);
}
