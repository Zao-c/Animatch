import { type Anime, type PoolComparisonMode, type PoolComparisonResult } from "@prisma/client";
import { AppError } from "./app-error";
import { getEffectiveAnimeDisplay } from "./anime-display";
import { toPublicAnime } from "./anime-service";
import { prisma } from "./db";

export interface ComparisonHistoryAnime {
  animeId: string;
  title: string;
  coverUrl: string | null;
  eloBefore: number | null;
  eloAfter: number | null;
  position: number | null;
}

export interface ComparisonHistoryItem {
  id: string;
  createdAt: string;
  result: PoolComparisonResult;
  mode: PoolComparisonMode;
  left: ComparisonHistoryAnime;
  right: ComparisonHistoryAnime;
  winnerAnimeId: string | null;
  loserAnimeId: string | null;
}

export interface ComparisonHistoryResult {
  items: ComparisonHistoryItem[];
}

export async function getComparisonHistory(params: {
  userId: string;
  poolId: string;
  runId: string;
  limit?: number;
}): Promise<ComparisonHistoryResult> {
  const limit = normalizeHistoryLimit(params.limit);
  const pool = await prisma.customPool.findUnique({
    where: {
      id: params.poolId
    },
    select: {
      id: true
    }
  });

  if (pool === null) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  const run = await prisma.personalRun.findUnique({
    where: {
      id: params.runId
    },
    select: {
      id: true,
      userId: true,
      poolId: true,
      deletedAt: true
    }
  });

  if (run === null || run.deletedAt !== null) {
    throw new AppError("Run not found", 404, "RUN_NOT_FOUND");
  }

  if (run.poolId !== params.poolId) {
    throw new AppError("Run does not belong to pool", 404, "RUN_POOL_MISMATCH");
  }

  if (run.userId !== params.userId) {
    throw new AppError("Run not found", 404, "RUN_NOT_FOUND");
  }

  const comparisons = await prisma.poolComparison.findMany({
    where: {
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit,
    include: {
      leftAnime: true,
      rightAnime: true
    }
  });
  const animeIds = Array.from(
    new Set(
      comparisons.flatMap((comparison) => [
        comparison.leftAnimeId,
        comparison.rightAnimeId
      ])
    )
  );
  const poolEntries =
    animeIds.length === 0
      ? []
      : await prisma.poolAnime.findMany({
          where: {
            poolId: params.poolId,
            animeId: {
              in: animeIds
            }
          },
          include: {
            anime: true
          }
        });
  const displayByAnimeId = new Map(
    poolEntries.map((entry) => [entry.animeId, getEffectiveAnimeDisplay(entry)])
  );

  return {
    items: comparisons.map((comparison) => ({
      id: comparison.id,
      createdAt: comparison.createdAt.toISOString(),
      result: comparison.result,
      mode: comparison.mode,
      left: toHistoryAnime({
        animeId: comparison.leftAnimeId,
        anime: comparison.leftAnime,
        title: displayByAnimeId.get(comparison.leftAnimeId)?.title,
        coverUrl: displayByAnimeId.get(comparison.leftAnimeId)?.coverUrl,
        eloBefore: comparison.leftEloBefore,
        eloAfter: comparison.leftEloAfter,
        position: comparison.leftPosition
      }),
      right: toHistoryAnime({
        animeId: comparison.rightAnimeId,
        anime: comparison.rightAnime,
        title: displayByAnimeId.get(comparison.rightAnimeId)?.title,
        coverUrl: displayByAnimeId.get(comparison.rightAnimeId)?.coverUrl,
        eloBefore: comparison.rightEloBefore,
        eloAfter: comparison.rightEloAfter,
        position: comparison.rightPosition
      }),
      winnerAnimeId: comparison.winnerAnimeId,
      loserAnimeId: comparison.loserAnimeId
    }))
  };
}

export function normalizeHistoryLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

function toHistoryAnime(input: {
  animeId: string;
  anime: Anime;
  title: string | undefined;
  coverUrl: string | null | undefined;
  eloBefore: number | null;
  eloAfter: number | null;
  position: number | null;
}): ComparisonHistoryAnime {
  const publicAnime = toPublicAnime(input.anime);

  return {
    animeId: input.animeId,
    title:
      input.title ??
      publicAnime.titleCn ??
      publicAnime.title ??
      publicAnime.titleJa ??
      publicAnime.titleEn ??
      "Untitled anime",
    coverUrl: input.coverUrl ?? publicAnime.coverUrl,
    eloBefore: input.eloBefore,
    eloAfter: input.eloAfter,
    position: input.position
  };
}
