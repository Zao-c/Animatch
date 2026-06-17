import { PersonalRunStatus } from "@prisma/client";
import { AppError } from "./app-error";
import { getAnimeCoverUrl } from "./anime-cover-url";
import { getEffectiveAnimeDisplay } from "./anime-display";
import { prisma } from "./db";
import { canReadCommunityRanking } from "./pool-permissions";

export interface CommunityRankingItem {
  animeId: string;
  title: string;
  imageUrl: string | null;
  averageRating: number | null;
  communityScore: number | null;
  participantCount: number;
  comparisonCount: number;
  rank: number | null;
  insufficientSample: boolean;
}

export interface CommunityRankingResponse {
  poolId: string;
  totalParticipants: number;
  totalRuns: number;
  totalAnime: number;
  minSampleThreshold: {
    minUsers: number;
    minComparisons: number;
  };
  items: CommunityRankingItem[];
}

const PRIOR_RATING = 1500;
const MIN_USERS = 3;
const MIN_COMPARISONS = 6;

interface AnimeAggregate {
  animeId: string;
  title: string;
  imageUrl: string | null;
  ratingSum: number;
  weightedEloSum: number;
  weightSum: number;
  participantIds: Set<string>;
  comparisonCount: number;
}

export async function getCommunityRanking(poolId: string): Promise<CommunityRankingResponse> {
  if (!poolId.trim()) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  const pool = await prisma.customPool.findUnique({
    where: {
      id: poolId
    },
    select: {
      id: true,
      visibility: true,
      status: true,
      deletedAt: true
    }
  });

  if (pool === null) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  if (!canReadCommunityRanking(pool)) {
    throw new AppError(
      "Community ranking is only available for active public pools",
      404,
      "COMMUNITY_RANKING_NOT_AVAILABLE"
    );
  }

  const poolAnime = await prisma.poolAnime.findMany({
    where: {
      poolId
    },
    orderBy: {
      position: "asc"
    },
    include: {
      anime: true
    }
  });
  const activeAnimeIds = new Set(poolAnime.map((entry) => entry.animeId));
  const aggregates = new Map<string, AnimeAggregate>();

  for (const entry of poolAnime) {
    const display = getEffectiveAnimeDisplay(entry);
    const displayCoverUrl = getAnimeCoverUrl(
      {
        coverUrlOverride: entry.coverUrlOverride,
        display: { coverUrl: display.coverUrl, isCoverOverridden: display.isCoverOverridden },
        coverUrl: entry.anime.imageUrl,
        imageUrl: entry.anime.imageUrl,
        imageSmallUrl: entry.anime.imageSmallUrl,
        imageMediumUrl: entry.anime.imageMediumUrl,
        imageLargeUrl: entry.anime.imageLargeUrl,
        thumbnailUrl: entry.anime.thumbnailUrl
      },
      { intent: "hero" }
    );
    aggregates.set(entry.animeId, {
      animeId: entry.animeId,
      title: display.title,
      imageUrl: displayCoverUrl,
      ratingSum: 0,
      weightedEloSum: 0,
      weightSum: 0,
      participantIds: new Set(),
      comparisonCount: 0
    });
  }

  const defaultRuns = await prisma.personalRun.findMany({
    where: {
      poolId,
      isDefault: true,
      status: PersonalRunStatus.ACTIVE,
      deletedAt: null
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      userId: true
    }
  });
  const runsByUserId = new Map<string, { id: string; userId: string }>();

  for (const run of defaultRuns) {
    if (!runsByUserId.has(run.userId)) {
      runsByUserId.set(run.userId, run);
    }
  }

  const currentRuns = [...runsByUserId.values()];
  const runById = new Map(currentRuns.map((run) => [run.id, run]));
  const runIds = currentRuns.map((run) => run.id);

  if (runIds.length > 0 && activeAnimeIds.size > 0) {
    const scores = await prisma.userPoolScore.findMany({
      where: {
        poolId,
        runId: {
          in: runIds
        },
        animeId: {
          in: [...activeAnimeIds]
        },
        compareCount: {
          gt: 0
        },
        isHidden: false
      },
      select: {
        userId: true,
        runId: true,
        animeId: true,
        eloScore: true,
        compareCount: true,
        isHidden: true
      }
    });
    const seenUserAnime = new Set<string>();

    for (const score of scores) {
      if (score.compareCount <= 0 || score.isHidden) {
        continue;
      }

      const run = runById.get(score.runId);
      if (run === undefined || run.userId !== score.userId) {
        continue;
      }

      const aggregate = aggregates.get(score.animeId);
      if (aggregate === undefined) {
        continue;
      }

      const userAnimeKey = `${score.userId}:${score.animeId}`;
      if (seenUserAnime.has(userAnimeKey)) {
        continue;
      }

      seenUserAnime.add(userAnimeKey);
      const userWeight = Math.min(score.compareCount / 5, 1);
      aggregate.ratingSum += score.eloScore;
      aggregate.weightedEloSum += score.eloScore * userWeight;
      aggregate.weightSum += userWeight;
      aggregate.participantIds.add(score.userId);
      aggregate.comparisonCount += score.compareCount;
    }
  }

  const items = [...aggregates.values()].map(toRankingItem);
  const sufficientItems = items
    .filter((item) => !item.insufficientSample)
    .sort(compareSufficientItems)
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  const insufficientItems = items
    .filter((item) => item.insufficientSample)
    .sort(compareInsufficientItems);
  const totalParticipants = new Set(
    items.flatMap((item) => {
      const aggregate = aggregates.get(item.animeId);
      return aggregate === undefined ? [] : [...aggregate.participantIds];
    })
  ).size;

  return {
    poolId,
    totalParticipants,
    totalRuns: currentRuns.length,
    totalAnime: poolAnime.length,
    minSampleThreshold: {
      minUsers: MIN_USERS,
      minComparisons: MIN_COMPARISONS
    },
    items: [...sufficientItems, ...insufficientItems]
  };
}

function toRankingItem(aggregate: AnimeAggregate): CommunityRankingItem {
  const participantCount = aggregate.participantIds.size;
  const insufficientSample =
    participantCount < MIN_USERS || aggregate.comparisonCount < MIN_COMPARISONS;

  return {
    animeId: aggregate.animeId,
    title: aggregate.title,
    imageUrl: aggregate.imageUrl,
    averageRating:
      participantCount === 0 ? null : aggregate.ratingSum / participantCount,
    communityScore:
      participantCount === 0
        ? null
        : (PRIOR_RATING * MIN_USERS + aggregate.weightedEloSum) /
          (MIN_USERS + aggregate.weightSum),
    participantCount,
    comparisonCount: aggregate.comparisonCount,
    rank: null,
    insufficientSample
  };
}

function compareSufficientItems(left: CommunityRankingItem, right: CommunityRankingItem): number {
  return (
    (right.communityScore ?? 0) - (left.communityScore ?? 0) ||
    right.participantCount - left.participantCount ||
    right.comparisonCount - left.comparisonCount ||
    left.title.localeCompare(right.title) ||
    left.animeId.localeCompare(right.animeId)
  );
}

function compareInsufficientItems(left: CommunityRankingItem, right: CommunityRankingItem): number {
  return (
    right.participantCount - left.participantCount ||
    right.comparisonCount - left.comparisonCount ||
    left.title.localeCompare(right.title) ||
    left.animeId.localeCompare(right.animeId)
  );
}
