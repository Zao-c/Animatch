import type { MatchPair } from "./client-api";
import { getAnimeCoverUrl, type AnimeCoverUrlFields } from "./anime-cover-url";
import { getProxiedCoverCandidates } from "./image-proxy";

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
  options: { preloadCount?: number } = {}
): Promise<{ loaded: number; total: number }> {
  const preloadCount = Math.max(0, Math.trunc(options.preloadCount ?? 4));
  const targetPairs = pairs.slice(0, preloadCount);
  const total = targetPairs.length * 2;

  if (targetPairs.length === 0) {
    return { loaded: 0, total: 0 };
  }

  const results = await Promise.all(
    targetPairs.flatMap((pair) => [
      preloadAnimeImage(pair.left),
      preloadAnimeImage(pair.right)
    ])
  );

  return {
    loaded: results.filter(Boolean).length,
    total
  };
}

async function preloadAnimeImage(anime: AnimeCoverUrlFields): Promise<boolean> {
  for (const src of bestImageCandidates(anime)) {
    const loaded = await preloadImage(src);
    if (loaded) {
      return true;
    }
  }

  return false;
}

function bestImageCandidates(anime: AnimeCoverUrlFields): string[] {
  const heroUrl = getAnimeCoverUrl(anime, { intent: "hero" });
  const exportUrl = getAnimeCoverUrl(anime, { intent: "export" });
  return getProxiedCoverCandidates(heroUrl, exportUrl);
}
