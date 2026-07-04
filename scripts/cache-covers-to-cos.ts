import { prisma } from "../src/lib/db";
import { cacheAnimeCoverToCos, isCosCoverCacheConfigured } from "../src/lib/server/cos-cover-cache";

interface Args {
  poolId?: string;
  limit: number;
  concurrency: number;
  force: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    limit: 100,
    concurrency: 2,
    force: false
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
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();

  if (!isCosCoverCacheConfigured()) {
    throw new Error("COS cover cache is not configured. Required env: COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION");
  }

  const where = args.poolId
    ? {
        poolEntries: {
          some: {
            poolId: args.poolId
          }
        },
        ...(args.force ? {} : { cachedCoverUrl: null })
      }
    : args.force
      ? {}
      : { cachedCoverUrl: null };

  const animes = await prisma.anime.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: args.limit,
    select: {
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
    }
  });

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < animes.length; index += args.concurrency) {
    const batch = animes.slice(index, index + args.concurrency);
    const results = await Promise.allSettled(
      batch.map((anime) => cacheAnimeCoverToCos(anime, { force: args.force }))
    );

    for (const [resultIndex, result] of results.entries()) {
      const anime = batch[resultIndex];
      if (result.status === "fulfilled") {
        if (result.value) {
          success += 1;
          console.log(`cached ${anime.id} ${anime.bgmId ?? ""} ${result.value.bytes} bytes`);
        } else {
          skipped += 1;
        }
      } else {
        failed += 1;
        console.warn(`failed ${anime.id} ${anime.bgmId ?? ""}: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`);
      }
    }
  }

  console.log(JSON.stringify({ scanned: animes.length, success, skipped, failed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
