import { getAnimeCoverUrl, type AnimeCoverUrlFields } from "@/lib/anime-cover-url";
import { prewarmCoverCacheBackground } from "@/lib/server/cover-cache-prewarm";
import { cacheAnimeCoverToCosBackground, cacheAnimeCoversToCosBackground } from "@/lib/server/cos-cover-cache";

export type PoolCoverCacheAnime = AnimeCoverUrlFields & {
  id: string;
  bgmId: number | null;
  title?: string | null;
  cachedCoverSourceUrl?: string | null;
};

export function enqueuePoolAnimeCoverCache(anime: PoolCoverCacheAnime | null | undefined): void {
  if (!anime) return;

  cacheAnimeCoverToCosBackground(anime);

  const primary = getAnimeCoverUrl(anime, { intent: "display" });
  const secondary = getAnimeCoverUrl(anime, { intent: "export" });
  prewarmCoverCacheBackground([primary, secondary], { limit: 2 });
}

export function enqueuePoolAnimeCoversCache(
  animes: Array<PoolCoverCacheAnime | null | undefined>,
  options: { proxyLimit?: number; proxyConcurrency?: number } = {}
): void {
  const validAnimes = animes.filter((anime): anime is PoolCoverCacheAnime => Boolean(anime));
  if (validAnimes.length === 0) return;

  cacheAnimeCoversToCosBackground(validAnimes);

  const urls = validAnimes.flatMap((anime) => [
    getAnimeCoverUrl(anime, { intent: "display" }),
    getAnimeCoverUrl(anime, { intent: "export" })
  ]);

  prewarmCoverCacheBackground(urls, {
    limit: options.proxyLimit ?? 60,
    concurrency: options.proxyConcurrency ?? 3
  });
}
