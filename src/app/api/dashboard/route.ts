import { PoolStatus } from "@prisma/client";
import { ok, fromError } from "@/lib/api-response";
import { DEMO_POOL_TAG } from "@/lib/demo-pool";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";

type PreviewSource = "CONTINUE_RUN" | "DEMO_POOL" | "EMPTY";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const pools = await prisma.customPool.findMany({
      where: {
        creatorId: user.id,
        status: {
          not: PoolStatus.ARCHIVED
        },
        deletedAt: null
      },
      include: {
        poolAnime: {
          orderBy: {
            position: "asc"
          },
          include: {
            anime: true
          }
        },
        personalRuns: {
          where: {
            userId: user.id,
            isDefault: true,
            status: {
              not: "DELETED"
            }
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 8
    });

    const continuePool = pools.find(
      (pool) => pool.poolAnime.length >= 2 && pool.personalRuns[0] !== undefined
    );

    if (continuePool !== undefined) {
      const runId = continuePool.personalRuns[0].id;
      return ok({
        miniMatchPreview: buildPreview({
          source: "CONTINUE_RUN",
          poolId: continuePool.id,
          runId,
          ctaHref: `/pools/${continuePool.id}/runs/${runId}/match`,
          ctaLabel: "\u5f00\u59cb\u771f\u5b9e\u5bf9\u51b3",
          entries: continuePool.poolAnime
        })
      });
    }

    const demoPool = pools.find(
      (pool) => pool.tags.includes(DEMO_POOL_TAG) && pool.poolAnime.length >= 2
    );

    if (demoPool !== undefined) {
      return ok({
        miniMatchPreview: buildPreview({
          source: "DEMO_POOL",
          poolId: demoPool.id,
          ctaLabel: "\u4f53\u9a8c\u793a\u4f8b\u756a\u7ec4",
          entries: demoPool.poolAnime
        })
      });
    }

    return ok({
      miniMatchPreview: {
        source: "EMPTY" satisfies PreviewSource,
        ctaLabel: "\u4f53\u9a8c\u793a\u4f8b\u756a\u7ec4",
        pairs: []
      }
    });
  } catch (error) {
    return fromError(error);
  }
}

function buildPreview(input: {
  source: Exclude<PreviewSource, "EMPTY">;
  poolId: string;
  runId?: string;
  ctaHref?: string;
  ctaLabel: string;
  entries: Array<{
    animeId: string;
    anime: {
      id: string;
      title: string;
      titleCn: string | null;
      imageUrl: string | null;
      thumbnailUrl: string | null;
      imageSmallUrl: string | null;
      imageMediumUrl: string | null;
      imageLargeUrl: string | null;
      year: number | null;
      animeType: string | null;
    };
  }>;
}) {
  const pairs = [];

  for (let index = 0; index + 1 < input.entries.length && pairs.length < 3; index += 2) {
    pairs.push({
      left: serializePreviewAnime(input.entries[index]),
      right: serializePreviewAnime(input.entries[index + 1])
    });
  }

  return {
    source: input.source,
    poolId: input.poolId,
    runId: input.runId,
    ctaHref: input.ctaHref,
    ctaLabel: input.ctaLabel,
    pairs
  };
}

function serializePreviewAnime(entry: {
  animeId: string;
  anime: {
    title: string;
    titleCn: string | null;
    imageUrl: string | null;
    thumbnailUrl: string | null;
    imageSmallUrl: string | null;
    imageMediumUrl: string | null;
    imageLargeUrl: string | null;
    year: number | null;
    animeType: string | null;
  };
}) {
  const meta = [entry.anime.animeType, entry.anime.year].filter(Boolean).join(" / ") || null;

  return {
    animeId: entry.animeId,
    title: entry.anime.title,
    titleCn: entry.anime.titleCn,
    imageUrl:
      entry.anime.thumbnailUrl ??
      entry.anime.imageUrl ??
      entry.anime.imageMediumUrl ??
      entry.anime.imageSmallUrl ??
      entry.anime.imageLargeUrl,
    meta
  };
}
