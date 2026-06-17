import type { MatchPair } from "./client-api";
import { getAnimeCoverUrl, type AnimeCoverUrlFields } from "./anime-cover-url";
import { proxyExternalImageUrl } from "./image-proxy";

export function preloadImage(src: string | null | undefined): Promise<boolean> {
  if (!src) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
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
  options: { firstPairRequired?: boolean; preloadCount?: number } = {}
): Promise<{ loaded: number; total: number }> {
  const preloadCount = Math.max(0, Math.trunc(options.preloadCount ?? 4));
  const targetPairs = pairs.slice(0, preloadCount);
  const total = targetPairs.length * 2;

  if (targetPairs.length === 0) {
    return { loaded: 0, total: 0 };
  }

  if (options.firstPairRequired === true) {
    await preloadPair(targetPairs[0]);
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
  const values = [
    proxyExternalImageUrl(heroUrl),
    proxyExternalImageUrl(exportUrl),
    heroUrl,
    exportUrl
  ];
  const seen = new Set<string>();

  return values.flatMap((value) => {
    if (value === null) return [];
    if (seen.has(value)) return [];
    seen.add(value);
    return [value];
  });
}
