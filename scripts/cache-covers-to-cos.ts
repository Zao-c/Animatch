import { prisma } from "../src/lib/db";
import { cacheAnimeCoverToCos, isCosCoverCacheConfigured } from "../src/lib/server/cos-cover-cache";

interface Args {
  poolId?: string;
  limit: number;
  concurrency: number;
  force: boolean;
  allLibrary: boolean;
}

interface CacheCandidate {
  id: string;
  bgmId: number | null;
  title: string | null;
  cachedCoverUrl: string | null;
  cachedCoverSourceUrl: string | null;
  imageUrl: string | null;
  imageSmallUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  thumbnailUrl: string | null;
}

interface CacheState {
  sourceUrl: string | null;
  needsCache: boolean;
  stale: boolean;
  reason: "missing-source" | "missing-cache" | "stale-source" | "fresh";
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    limit: 100,
    concurrency: 2,
    force: false,
    allLibrary: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--pool-id" && args[index + 1]) {
      result.poolId = args[++index];
    } else if (arg === "--limit" && args[index + 1]) {
      result.limit = Math.max(1, Number(args[++index]) || result.limit);
    } else if (arg === "--concurrency" && args[index + 1]) {
      result.concurrency = Math.max(1, Math.min(4, Number(args[++index]) || result.concurrency));
    } else if (arg === "--force") {
      result.force = true;
    } else if (arg === "--all-library") {
      result.allLibrary = true;
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();

  if (!isCosCoverCacheConfigured()) {
    throw new Error("COS cover cache is not configured. Required env: COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION");
  }

  const activePoolFilter = args.poolId
    ? {
        poolEntries: {
          some: {
            poolId: args.poolId,
            pool: {
              deletedAt: null,
              status: { not: "ARCHIVED" as const }
            }
          }
        }
      }
    : {
        poolEntries: {
          some: {
            pool: {
              deletedAt: null,
              status: { not: "ARCHIVED" as const }
            }
          }
        }
      };

  const where = args.allLibrary ? {} : activePoolFilter;

  const usedWhere = args.poolId ? activePoolFilter : {
    poolEntries: {
      some: {
        pool: {
          deletedAt: null,
          status: { not: "ARCHIVED" as const }
        }
      }
    }
  };
  const [usedAnimeCount, usedCachedAnimeCount, usedAnimesForStats] = await Promise.all([
    prisma.anime.count({ where: usedWhere }),
    prisma.anime.count({
      where: {
        ...usedWhere,
        cachedCoverUrl: { not: null }
      }
    }),
    prisma.anime.findMany({
      where: usedWhere,
      select: animeSelect()
    })
  ]);
  const usedCacheStates = usedAnimesForStats.map(getCacheState);
  const usedPendingAnimeCount = usedCacheStates.filter((state) => state.needsCache).length;
  const usedStaleAnimeCount = usedCacheStates.filter((state) => state.stale).length;

  console.log(JSON.stringify({
    scope: args.allLibrary ? "all-library" : args.poolId ? "pool" : "active-pool-anime",
    poolId: args.poolId ?? null,
    usedAnimeCount,
    usedCachedAnimeCount,
    usedPendingAnimeCount,
    usedStaleAnimeCount,
    usedAnimeCoverRate: usedAnimeCount > 0 ? Number((usedCachedAnimeCount / usedAnimeCount).toFixed(4)) : 0
  }, null, 2));

  const scanLimit = args.allLibrary ? Math.max(args.limit * 10, args.limit) : undefined;
  const animes = await prisma.anime.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    ...(scanLimit === undefined ? {} : { take: scanLimit }),
    select: animeSelect()
  });
  const candidates = animes
    .map((anime) => ({ anime, state: getCacheState(anime) }))
    .filter(({ state }) => args.force || state.needsCache)
    .slice(0, args.limit);

  let success = 0;
  let skipped = 0;
  let failed = 0;
  let stale = 0;

  for (let index = 0; index < candidates.length; index += args.concurrency) {
    const batch = candidates.slice(index, index + args.concurrency);
    const results = await Promise.allSettled(
      batch.map(({ anime }) => cacheAnimeCoverToCos(anime, { force: args.force }))
    );

    for (const [resultIndex, result] of results.entries()) {
      const { anime, state } = batch[resultIndex];
      if (result.status === "fulfilled") {
        if (result.value) {
          success += 1;
          if (state.stale) stale += 1;
          console.log(`cached ${anime.id} ${anime.bgmId ?? ""} ${state.reason} ${result.value.bytes} bytes`);
        } else {
          skipped += 1;
        }
      } else {
        failed += 1;
        console.warn(`failed ${anime.id} ${anime.bgmId ?? ""}: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`);
      }
    }
  }

  console.log(JSON.stringify({
    scanned: animes.length,
    selected: candidates.length,
    success,
    stale,
    skipped,
    failed
  }, null, 2));
}

function animeSelect() {
  return {
    id: true,
    bgmId: true,
    title: true,
    cachedCoverUrl: true,
    cachedCoverSourceUrl: true,
    imageUrl: true,
    imageSmallUrl: true,
    imageMediumUrl: true,
    imageLargeUrl: true,
    thumbnailUrl: true
  } as const;
}

function getCacheState(anime: CacheCandidate): CacheState {
  const sourceUrl = pickSourceCoverUrl(anime);
  if (!sourceUrl) {
    return {
      sourceUrl: null,
      needsCache: false,
      stale: false,
      reason: "missing-source"
    };
  }
  if (!anime.cachedCoverUrl || !anime.cachedCoverSourceUrl) {
    return {
      sourceUrl,
      needsCache: true,
      stale: false,
      reason: "missing-cache"
    };
  }
  if (anime.cachedCoverSourceUrl !== sourceUrl) {
    return {
      sourceUrl,
      needsCache: true,
      stale: true,
      reason: "stale-source"
    };
  }
  return {
    sourceUrl,
    needsCache: false,
    stale: false,
    reason: "fresh"
  };
}

function pickSourceCoverUrl(anime: CacheCandidate): string | null {
  const candidates = [
    anime.imageLargeUrl,
    anime.imageMediumUrl,
    anime.imageUrl,
    anime.imageSmallUrl,
    anime.thumbnailUrl
  ];

  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (url && /^https?:\/\//i.test(url) && !isCosObjectUrl(url)) {
      return url;
    }
  }

  return null;
}

function isCosObjectUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return /\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(hostname) || hostname.endsWith(".file.myqcloud.com");
  } catch {
    return false;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
