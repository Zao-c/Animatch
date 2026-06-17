import { fromError, notFound, ok } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";

interface RouteContext {
  params: { username: string };
}

function toCoverStrip(
  animes: Array<{
    imageUrl: string | null;
    imageSmallUrl: string | null;
    imageMediumUrl: string | null;
    imageLargeUrl: string | null;
    thumbnailUrl: string | null;
    coverEnabled?: boolean;
  }>,
  maxCount = 5
): string[] {
  return animes
    .slice(0, maxCount)
    .map((a) => getAnimeCoverUrl(a, { intent: "display" }))
    .filter((u): u is string => u !== null && u.length > 0);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { username } = context.params;

    const user = await prisma.user.findFirst({
      where: {
        username,
        deletedAt: null
      },
      select: {
        id: true,
        username: true,
        name: true,
        image: true,
        createdAt: true
      }
    });

    if (user === null) {
      return notFound("用户不存在");
    }

    const [
      publicPoolsRaw,
      publicPoolCount,
      tierShares,
      sharedTierListCount,
      participatedPoolCount
    ] = await Promise.all([
      prisma.customPool.findMany({
        where: {
          creatorId: user.id,
          visibility: "PUBLIC",
          deletedAt: null
        },
        include: {
          poolAnime: {
            include: { anime: true },
            take: 5,
            orderBy: { position: "asc" }
          },
          _count: {
            select: {
              poolAnime: true,
              personalRuns: true
            }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 12
      }),
      prisma.customPool.count({
        where: {
          creatorId: user.id,
          visibility: "PUBLIC",
          deletedAt: null
        }
      }),
      prisma.tierShare.findMany({
        where: {
          run: {
            userId: user.id
          }
        },
        include: {
          run: {
            select: {
              pool: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.tierShare.count({
        where: {
          run: {
            userId: user.id
          }
        }
      }),
      prisma.userPoolScore.groupBy({
        by: ["poolId"],
        where: {
          userId: user.id
        }
      }).then((groups) => groups.length)
    ]);

    const publicPools = publicPoolsRaw.map((pool) => {
      const poolAnime = pool.poolAnime ?? [];
      return {
        id: pool.id,
        name: pool.name,
        description: pool.description,
        animeCount: pool._count.poolAnime,
        tierListCount: pool._count.personalRuns,
        coverUrls: toCoverStrip(poolAnime.map((pa) => pa.anime)),
        createdAt: pool.createdAt instanceof Date ? pool.createdAt.toISOString() : String(pool.createdAt),
        updatedAt: pool.updatedAt instanceof Date ? pool.updatedAt.toISOString() : String(pool.updatedAt)
      };
    });

    const publicTierLists = tierShares.map((ts) => {
      const snapshot = ts.snapshot as Record<string, unknown>;
      const tiers = (snapshot?.tiers as unknown[]) ?? [];
      const tierItems = tiers.flatMap(
        (t: unknown) => (t as { items?: unknown[] })?.items ?? []
      ) as Array<Record<string, unknown>>;

      return {
        token: ts.token,
        title: ts.title,
        poolName: (ts.run?.pool?.name) ?? "未知番组",
        animeCount: (snapshot?.animeCount as number) ?? tierItems.length,
        comparisonCount: (snapshot?.comparisonCount as number) ?? 0,
        coverUrls: toCoverStrip(
          tierItems.slice(0, 5).map((item) => ({
            imageUrl: (item?.imageUrl as string | null) ?? null,
            imageSmallUrl: (item?.imageSmallUrl as string | null) ?? null,
            imageMediumUrl: (item?.imageMediumUrl as string | null) ?? null,
            imageLargeUrl: (item?.imageLargeUrl as string | null) ?? null,
            thumbnailUrl: (item?.thumbnailUrl as string | null) ?? null,
            coverUrl: (item?.coverUrl as string | null) ?? null
          }))
        ),
        createdAt: ts.createdAt instanceof Date ? ts.createdAt.toISOString() : String(ts.createdAt)
      };
    });

    return ok({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt)
      },
      stats: {
        publicPoolsCount: publicPoolCount,
        sharedTierListCount,
        participatedPoolCount
      },
      publicPools,
      publicTierLists
    });
  } catch (error) {
    return fromError(error);
  }
}
