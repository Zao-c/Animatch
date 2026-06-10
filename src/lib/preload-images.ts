import type { MatchPair } from "./client-api";

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
  const [leftLoaded, rightLoaded] = await preloadPairImages(pair);

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

  const firstPairResults =
    options.firstPairRequired === true ? await preloadPairImages(targetPairs[0]) : [];
  const remainingPairs = options.firstPairRequired === true ? targetPairs.slice(1) : targetPairs;

  const remainingResults = await Promise.all(
    remainingPairs.flatMap((pair) => [
      preloadImage(bestImageSrc(pair.left)),
      preloadImage(bestImageSrc(pair.right))
    ])
  );
  const results = [...firstPairResults, ...remainingResults];

  return {
    loaded: results.filter(Boolean).length,
    total
  };
}

function preloadPairImages(pair: MatchPair): Promise<[boolean, boolean]> {
  return Promise.all([
    preloadImage(bestImageSrc(pair.left)),
    preloadImage(bestImageSrc(pair.right))
  ]);
}

function bestImageSrc(anime: {
  imageLargeUrl?: string | null;
  imageMediumUrl?: string | null;
  imageUrl?: string | null;
  imageSmallUrl?: string | null;
}): string | null {
  return anime.imageLargeUrl ?? anime.imageMediumUrl ?? anime.imageUrl ?? anime.imageSmallUrl ?? null;
}
