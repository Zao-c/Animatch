import { prisma } from "./db";
import { AppError } from "./app-error";
import { canEditPoolContent, canPlayPool, canReadPool } from "./pool-permissions";
import { getAnimeCoverUrl } from "./anime-cover-url";
import { updateElo } from "./elo";
import { resolveTierRows, type PoolTierConfig, type TierRowConfig } from "./tier-config";
import { Prisma, type BattleSeason, type BattleSeasonMode, type BattleSeasonUserScore } from "@prisma/client";

export type SeasonMode = BattleSeasonMode;

export interface SeasonCreateInput {
  title: string;
  description?: string;
  mode: SeasonMode;
  startsAt?: Date;
  endsAt?: Date;
  maxVotesPerUser?: number;
  maxVotesPerUserPerDay?: number;
  biasVotesPerUser?: number;
}

export interface SeasonUpdateInput {
  title?: string;
  description?: string | null;
  mode?: SeasonMode;
  startsAt?: Date;
  endsAt?: Date | null;
  maxVotesPerUser?: number;
  maxVotesPerUserPerDay?: number | null;
  biasVotesPerUser?: number;
}

type NormalizedSeasonCreateInput = {
  title: string;
  description: string | null;
  mode: SeasonMode;
  startsAt: Date;
  endsAt: Date | null;
  maxVotesPerUser: number;
  maxVotesPerUserPerDay: number | null;
  biasVotesPerUser: number;
};

type NormalizedSeasonUpdateInput = {
  title?: string;
  description?: string | null;
  mode?: SeasonMode;
  startsAt?: Date;
  endsAt?: Date | null;
  maxVotesPerUser?: number;
  maxVotesPerUserPerDay?: number | null;
  biasVotesPerUser?: number;
};

export interface SeasonListItem {
  id: string;
  poolId: string;
  title: string;
  mode: SeasonMode;
  status: string;
  startsAt: string;
  endsAt: string | null;
  maxVotesPerUser: number;
  biasVotesPerUser: number;
  participantCount: number;
  totalVotes: number;
  createdAt: string;
}

export interface SeasonDetail {
  id: string;
  poolId: string;
  title: string;
  description: string | null;
  mode: SeasonMode;
  status: string;
  startsAt: string;
  endsAt: string | null;
  maxVotesPerUser: number;
  maxVotesPerUserPerDay: number | null;
  biasVotesPerUser: number;
  createdByUserId: string;
  participantCount: number;
  totalVotes: number;
  biasVotesUsed: number;
  ranking: SeasonRankingItem[];
  currentUserRanking: SeasonPersonalRankingItem[];
  recentVotes: RecentVoteEntry[];
  currentUserState: CurrentUserState | null;
  currentUserCanManage: boolean;
  tierRows: TierRowConfig[];
  minSampleThreshold: {
    minUsers: number;
    minComparisons: number;
  };
  createdAt: string;
}

export interface SeasonRankingItem {
  animeId: string;
  title: string;
  score: number;
  winCount: number;
  lossCount: number;
  biasWinCount: number;
  participantCount: number;
  comparisonCount: number;
  insufficientSample: boolean;
  averageElo: number | null;
  imageUrl: string | null;
}

export interface SeasonPersonalRankingItem {
  animeId: string;
  title: string;
  score: number;
  uncertainty: number;
  winCount: number;
  lossCount: number;
  biasWinCount: number;
  comparisonCount: number;
  imageUrl: string | null;
}

export interface RecentVoteEntry {
  id: string;
  stepNumber: number;
  username: string;
  displayName: string;
  winnerTitle: string;
  loserTitle: string;
  voteType: string;
  weight: number;
  winnerEloDelta: number | null;
  loserEloDelta: number | null;
  createdAt: string;
}

export interface CurrentUserState {
  votesUsed: number;
  votesRemaining: number;
  biasVotesUsed: number;
  biasVotesRemaining: number;
  dailyVotesUsed?: number;
  hiddenAnimeIds: string[];
}

export interface SeasonMatchQueueItem {
  pairId: string;
  left: SeasonAnimeEntry;
  right: SeasonAnimeEntry;
  reason: "NEW_PAIR" | "RECALIBRATION";
}

export interface SeasonMatchQueueOptions {
  limit?: number;
  excludePairKeys?: string[];
  hiddenAnimeIds?: string[];
}

export interface SeasonAnimeEntry {
  animeId: string;
  title: string;
  imageUrl: string | null;
  imageLargeUrl: string | null;
  imageMediumUrl: string | null;
  imageSmallUrl: string | null;
  cachedCoverUrl: string | null;
  thumbnailUrl: string | null;
  source: string;
  animeType: string | null;
}

export interface VoteInput {
  leftAnimeId: string;
  rightAnimeId: string;
  winnerAnimeId: string;
  useBiasVote?: boolean;
  clientMutationId?: string;
}

export interface VoteResult {
  id: string;
  stepNumber: number;
  voteType: string;
  weight: number;
  votesRemaining: number;
}

type ExistingBattleVoteResult = {
  id: string;
  stepNumber: number;
  voteType: "NORMAL" | "BIAS";
  weight: number;
};

const MAX_VOTE_WRITE_ATTEMPTS = 5;
const VOTE_WRITE_RETRY_BASE_DELAY_MS = 45;
const SEASON_PRIOR_RATING = 1500;
const SEASON_INITIAL_UNCERTAINTY = 350;
const SEASON_MIN_USERS = 3;
const SEASON_MIN_COMPARISONS = 6;
const SEASON_BIAS_AGGREGATION_MULTIPLIER = 1.5;
const SEASON_DAILY_LIMIT_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
export const SEASON_DAILY_LIMIT_TIME_ZONE = "Asia/Shanghai";

export function getSeasonDailyVoteWindow(now = new Date()): { start: Date; end: Date; timeZone: string } {
  const shifted = new Date(now.getTime() + SEASON_DAILY_LIMIT_UTC_OFFSET_MS);
  const shiftedDayStart = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );
  const start = new Date(shiftedDayStart - SEASON_DAILY_LIMIT_UTC_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    start,
    end,
    timeZone: SEASON_DAILY_LIMIT_TIME_ZONE
  };
}

async function getPoolAnimeIds(poolId: string): Promise<string[]> {
  const entries = await prisma.poolAnime.findMany({
    where: { poolId },
    select: { animeId: true }
  });
  return entries.map((e) => e.animeId);
}

type SeasonTx = Prisma.TransactionClient;
type SeasonScore = Pick<
  BattleSeasonUserScore,
  | "seasonId"
  | "poolId"
  | "userId"
  | "animeId"
  | "eloScore"
  | "uncertainty"
  | "compareCount"
  | "winCount"
  | "lossCount"
  | "biasWinCount"
  | "unseenCount"
  | "isHidden"
  | "lastVotedAt"
>;

async function getPoolAnimeSeedRows(
  db: typeof prisma | SeasonTx,
  poolId: string
): Promise<Array<{ animeId: string; initialElo: number }>> {
  const entries = await db.poolAnime.findMany({
    where: { poolId },
    select: { animeId: true, initialElo: true }
  });
  return entries.map((entry) => ({
    animeId: entry.animeId,
    initialElo: entry.initialElo
  }));
}

async function ensureSeasonUserScores(
  db: typeof prisma | SeasonTx,
  poolId: string,
  seasonId: string,
  userId: string
): Promise<SeasonScore[]> {
  const poolAnime = await getPoolAnimeSeedRows(db, poolId);
  if (poolAnime.length === 0) return [];

  const existing = await db.battleSeasonUserScore.findMany({
    where: { seasonId, userId },
    select: {
      seasonId: true,
      poolId: true,
      userId: true,
      animeId: true,
      eloScore: true,
      uncertainty: true,
      compareCount: true,
      winCount: true,
      lossCount: true,
      biasWinCount: true,
      unseenCount: true,
      isHidden: true,
      lastVotedAt: true
    }
  });
  const existingAnimeIds = new Set(existing.map((score) => score.animeId));
  const missing = poolAnime.filter((entry) => !existingAnimeIds.has(entry.animeId));

  if (missing.length > 0) {
    await db.battleSeasonUserScore.createMany({
      data: missing.map((entry) => ({
        seasonId,
        poolId,
        userId,
        animeId: entry.animeId,
        eloScore: entry.initialElo,
        uncertainty: SEASON_INITIAL_UNCERTAINTY
      })),
      skipDuplicates: true
    });
  }

  return db.battleSeasonUserScore.findMany({
    where: { seasonId, userId },
    select: {
      seasonId: true,
      poolId: true,
      userId: true,
      animeId: true,
      eloScore: true,
      uncertainty: true,
      compareCount: true,
      winCount: true,
      lossCount: true,
      biasWinCount: true,
      unseenCount: true,
      isHidden: true,
      lastVotedAt: true
    }
  });
}

function validateSeasonAccess(season: BattleSeason, now: Date): void {
  if (season.status === "DRAFT") {
    throw new AppError("Season is not active", 400, "SEASON_NOT_ACTIVE");
  }
  if (season.status === "ENDED") {
    throw new AppError("Season has ended", 400, "SEASON_ENDED");
  }
  if (now < season.startsAt) {
    throw new AppError("Season has not started", 400, "SEASON_NOT_STARTED");
  }
  if (season.endsAt && now > season.endsAt) {
    throw new AppError("Season has ended", 400, "SEASON_ENDED");
  }
}

async function getReadableSeasonPool(poolId: string, userId: string | null) {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  if (!canReadPool(pool, userId ? { id: userId } : null)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  return pool;
}

async function getPlayableSeasonPool(poolId: string, userId: string) {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  if (pool.status === "ARCHIVED") {
    throw new AppError("Archived pools cannot accept season votes", 400, "POOL_ARCHIVED");
  }
  if (!canPlayPool(pool, { id: userId })) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  return pool;
}

function assertValidDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new AppError(`${field} is invalid`, 400, "INVALID_SEASON_INPUT");
  }
  return value;
}

function assertPositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError(`${field} must be at least 1`, 400, "INVALID_SEASON_INPUT");
  }
  return value;
}

function assertNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(`${field} cannot be negative`, 400, "INVALID_SEASON_INPUT");
  }
  return value;
}

function assertSeasonDateRange(startsAt: Date | undefined, endsAt: Date | null | undefined) {
  if (startsAt !== undefined) assertValidDate(startsAt, "startsAt");
  if (endsAt !== undefined && endsAt !== null) assertValidDate(endsAt, "endsAt");
  if (startsAt !== undefined && endsAt !== undefined && endsAt !== null && endsAt <= startsAt) {
    throw new AppError("endsAt must be after startsAt", 400, "INVALID_SEASON_INPUT");
  }
}

export function normalizeSeasonCreateInput(input: SeasonCreateInput): NormalizedSeasonCreateInput {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new AppError("Season title is required", 400, "INVALID_SEASON_INPUT");
  }

  const startsAt = input.startsAt ?? new Date();
  const endsAt = input.endsAt ?? null;
  assertSeasonDateRange(startsAt, endsAt);

  return {
    title,
    description: input.description?.trim() || null,
    mode: input.mode,
    startsAt,
    endsAt,
    maxVotesPerUser: assertPositiveInteger(input.maxVotesPerUser ?? 50, "maxVotesPerUser"),
    maxVotesPerUserPerDay:
      input.maxVotesPerUserPerDay === undefined
        ? null
        : assertPositiveInteger(input.maxVotesPerUserPerDay, "maxVotesPerUserPerDay"),
    biasVotesPerUser: assertNonNegativeInteger(input.biasVotesPerUser ?? 3, "biasVotesPerUser")
  };
}

export function normalizeSeasonUpdateInput(input: SeasonUpdateInput): NormalizedSeasonUpdateInput {
  const normalized: NormalizedSeasonUpdateInput = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length === 0) {
      throw new AppError("Season title is required", 400, "INVALID_SEASON_INPUT");
    }
    normalized.title = title;
  }

  if (input.description !== undefined) {
    normalized.description = input.description?.trim() || null;
  }

  if (input.mode !== undefined) normalized.mode = input.mode;
  if (input.startsAt !== undefined) normalized.startsAt = assertValidDate(input.startsAt, "startsAt");
  if (input.endsAt !== undefined) {
    normalized.endsAt = input.endsAt === null ? null : assertValidDate(input.endsAt, "endsAt");
  }
  assertSeasonDateRange(normalized.startsAt, normalized.endsAt);

  if (input.maxVotesPerUser !== undefined) {
    normalized.maxVotesPerUser = assertPositiveInteger(input.maxVotesPerUser, "maxVotesPerUser");
  }
  if (input.maxVotesPerUserPerDay !== undefined) {
    normalized.maxVotesPerUserPerDay =
      input.maxVotesPerUserPerDay === null
        ? null
        : assertPositiveInteger(input.maxVotesPerUserPerDay, "maxVotesPerUserPerDay");
  }
  if (input.biasVotesPerUser !== undefined) {
    normalized.biasVotesPerUser = assertNonNegativeInteger(input.biasVotesPerUser, "biasVotesPerUser");
  }

  return normalized;
}

export async function createSeason(
  poolId: string,
  userId: string,
  input: SeasonCreateInput
): Promise<BattleSeason> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  if (pool.status === "ARCHIVED") throw new AppError("Archived pools cannot create seasons", 400, "POOL_ARCHIVED");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const normalized = normalizeSeasonCreateInput(input);

  return prisma.battleSeason.create({
    data: {
      poolId,
      title: normalized.title,
      description: normalized.description,
      mode: normalized.mode,
      startsAt: normalized.startsAt,
      endsAt: normalized.endsAt,
      maxVotesPerUser: normalized.maxVotesPerUser,
      maxVotesPerUserPerDay: normalized.maxVotesPerUserPerDay,
      biasVotesPerUser: normalized.biasVotesPerUser,
      createdByUserId: userId
    }
  });
}

export async function listSeasons(poolId: string, userId: string | null): Promise<SeasonListItem[]> {
  await getReadableSeasonPool(poolId, userId);

  const seasons = await prisma.battleSeason.findMany({
    where: { poolId },
    include: {
      _count: { select: { votes: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const participantGroups = seasons.length > 0
    ? await prisma.battleVote.groupBy({
        by: ["seasonId", "userId"],
        where: { seasonId: { in: seasons.map((s) => s.id) } }
      })
    : [];

  const participantCountMap = new Map<string, number>();
  for (const participant of participantGroups) {
    participantCountMap.set(
      participant.seasonId,
      (participantCountMap.get(participant.seasonId) ?? 0) + 1
    );
  }

  return seasons.map((s) => ({
    id: s.id,
    poolId: s.poolId,
    title: s.title,
    mode: s.mode,
    status: s.status,
    startsAt: s.startsAt instanceof Date ? s.startsAt.toISOString() : String(s.startsAt),
    endsAt: s.endsAt instanceof Date ? s.endsAt.toISOString() : null,
    maxVotesPerUser: s.maxVotesPerUser,
    biasVotesPerUser: s.biasVotesPerUser,
    participantCount: participantCountMap.get(s.id) ?? 0,
    totalVotes: s._count.votes,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt)
  }));
}

export async function getSeasonDetail(
  poolId: string,
  seasonId: string,
  userId: string | null
): Promise<SeasonDetail> {
  const pool = await getReadableSeasonPool(poolId, userId);

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");

  await maybeRebuildSeasonScoresFromVotes(poolId, seasonId);

  const [participantCount, totalVotes, biasCount, recentVotesRaw, ranking] = await Promise.all([
    prisma.battleVote.groupBy({
      by: ["userId"],
      where: { seasonId },
      _count: true
    }).then((groups) => groups.length),
    prisma.battleVote.count({ where: { seasonId } }),
    prisma.battleVote.count({ where: { seasonId, voteType: "BIAS" } }),
    prisma.battleVote.findMany({
      where: { seasonId },
      include: {
        user: { select: { id: true, username: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    aggregateSeasonRanking(poolId, seasonId)
  ]);

  const recentVoteAnimeIds = [
    ...new Set(recentVotesRaw.flatMap((v) => [v.winnerAnimeId, v.loserAnimeId]))
  ];
  const recentVoteAnime = recentVoteAnimeIds.length > 0
    ? await prisma.anime.findMany({
        where: { id: { in: recentVoteAnimeIds } },
        select: { id: true, titleCn: true, titleJa: true, title: true }
      })
    : [];
  const recentVoteAnimeById = new Map(recentVoteAnime.map((anime) => [anime.id, anime]));

  const recentVotes: RecentVoteEntry[] = recentVotesRaw.map((v) => {
    const winner = recentVoteAnimeById.get(v.winnerAnimeId);
    const loser = recentVoteAnimeById.get(v.loserAnimeId);

    return {
      id: v.id,
      stepNumber: v.stepNumber,
      username: v.user.username ?? "unknown",
      displayName: v.user.name ?? v.user.username ?? "unknown",
      winnerTitle: winner?.titleCn ?? winner?.titleJa ?? winner?.title ?? v.winnerAnimeId,
      loserTitle: loser?.titleCn ?? loser?.titleJa ?? loser?.title ?? v.loserAnimeId,
      voteType: v.voteType,
      weight: v.weight,
      winnerEloDelta:
        v.afterWinnerElo !== null && v.beforeWinnerElo !== null
          ? v.afterWinnerElo - v.beforeWinnerElo
          : null,
      loserEloDelta:
        v.afterLoserElo !== null && v.beforeLoserElo !== null
          ? v.afterLoserElo - v.beforeLoserElo
          : null,
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt)
    };
  });

  let currentUserState: CurrentUserState | null = null;
  let currentUserRanking: SeasonPersonalRankingItem[] = [];
  if (userId) {
    const [userVotes, biasUsed, hiddenRows, userRanking] = await Promise.all([
      prisma.battleVote.count({
        where: { seasonId, userId }
      }),
      prisma.battleVote.count({
        where: { seasonId, userId, voteType: "BIAS" }
      }),
      prisma.battleSeasonUserScore.findMany({
        where: { seasonId, userId, isHidden: true },
        select: { animeId: true }
      }),
      aggregateCurrentUserSeasonRanking(poolId, seasonId, userId)
    ]);
    currentUserRanking = userRanking;

    let dailyUsed: number | undefined = undefined;
    if (season.maxVotesPerUserPerDay) {
      const dailyWindow = getSeasonDailyVoteWindow();
      dailyUsed = await prisma.battleVote.count({
        where: {
          seasonId,
          userId,
          createdAt: { gte: dailyWindow.start, lt: dailyWindow.end }
        }
      });
    }

    currentUserState = {
      votesUsed: userVotes,
      votesRemaining: Math.max(0, season.maxVotesPerUser - userVotes),
      biasVotesUsed: biasUsed,
      biasVotesRemaining: Math.max(0, season.biasVotesPerUser - biasUsed),
      dailyVotesUsed: dailyUsed,
      hiddenAnimeIds: hiddenRows.map((row) => row.animeId)
    };
  }

  return {
    id: season.id,
    poolId: season.poolId,
    title: season.title,
    description: season.description,
    mode: season.mode,
    status: season.status,
    startsAt: season.startsAt instanceof Date ? season.startsAt.toISOString() : String(season.startsAt),
    endsAt: season.endsAt instanceof Date ? season.endsAt.toISOString() : null,
    maxVotesPerUser: season.maxVotesPerUser,
    maxVotesPerUserPerDay: season.maxVotesPerUserPerDay,
    biasVotesPerUser: season.biasVotesPerUser,
    createdByUserId: season.createdByUserId,
    participantCount,
      totalVotes,
      biasVotesUsed: biasCount,
      ranking,
      currentUserRanking,
      recentVotes,
    currentUserState,
    tierRows: resolveTierRows(pool.tierConfig as PoolTierConfig | null),
    currentUserCanManage: false,
    minSampleThreshold: {
      minUsers: SEASON_MIN_USERS,
      minComparisons: SEASON_MIN_COMPARISONS
    },
    createdAt: season.createdAt instanceof Date ? season.createdAt.toISOString() : String(season.createdAt)
  };
}

interface SeasonRankingAggregate {
  animeId: string;
  title: string;
  imageUrl: string | null;
  weightedEloSum: number;
  rawEloSum: number;
  weightSum: number;
  participantIds: Set<string>;
  comparisonCount: number;
  winCount: number;
  lossCount: number;
  biasWinCount: number;
}

async function aggregateSeasonRanking(
  poolId: string,
  seasonId: string
): Promise<SeasonRankingItem[]> {
  const poolAnime = await prisma.poolAnime.findMany({
    where: { poolId },
    select: {
      animeId: true,
      anime: {
        select: {
          title: true,
          titleCn: true,
          titleJa: true,
          imageUrl: true,
          imageMediumUrl: true,
          imageLargeUrl: true,
          cachedCoverUrl: true
        }
      }
    },
    orderBy: { position: "asc" }
  });
  const activeAnimeIds = new Set(poolAnime.map((entry) => entry.animeId));
  const aggregates = new Map<string, SeasonRankingAggregate>();

  for (const entry of poolAnime) {
    aggregates.set(entry.animeId, {
      animeId: entry.animeId,
      title: entry.anime.titleCn ?? entry.anime.titleJa ?? entry.anime.title ?? entry.animeId,
      imageUrl: entry.anime.cachedCoverUrl ?? entry.anime.imageMediumUrl ?? entry.anime.imageLargeUrl ?? entry.anime.imageUrl,
      weightedEloSum: 0,
      rawEloSum: 0,
      weightSum: 0,
      participantIds: new Set(),
      comparisonCount: 0,
      winCount: 0,
      lossCount: 0,
      biasWinCount: 0
    });
  }

  if (activeAnimeIds.size === 0) return [];

  const scores = await prisma.battleSeasonUserScore.findMany({
    where: {
      seasonId,
      animeId: { in: [...activeAnimeIds] },
      compareCount: { gt: 0 },
      isHidden: false
    },
    select: {
      userId: true,
      animeId: true,
      eloScore: true,
      compareCount: true,
      winCount: true,
      lossCount: true,
      biasWinCount: true
    }
  });

  const seenUserAnime = new Set<string>();
  for (const score of scores) {
    const aggregate = aggregates.get(score.animeId);
    if (aggregate === undefined) continue;

    const userAnimeKey = `${score.userId}:${score.animeId}`;
    if (seenUserAnime.has(userAnimeKey)) continue;
    seenUserAnime.add(userAnimeKey);

    const baseWeight = Math.min(score.compareCount / 5, 1);
    const userWeight =
      score.biasWinCount > 0
        ? baseWeight * SEASON_BIAS_AGGREGATION_MULTIPLIER
        : baseWeight;

    aggregate.rawEloSum += score.eloScore;
    aggregate.weightedEloSum += score.eloScore * userWeight;
    aggregate.weightSum += userWeight;
    aggregate.participantIds.add(score.userId);
    aggregate.comparisonCount += score.compareCount;
    aggregate.winCount += score.winCount;
    aggregate.lossCount += score.lossCount;
    aggregate.biasWinCount += score.biasWinCount;
  }

  return [...aggregates.values()]
    .map((aggregate) => {
      const participantCount = aggregate.participantIds.size;
      const insufficientSample =
        participantCount < SEASON_MIN_USERS || aggregate.comparisonCount < SEASON_MIN_COMPARISONS;
      return {
        animeId: aggregate.animeId,
        title: aggregate.title,
        score:
          participantCount === 0
            ? SEASON_PRIOR_RATING
            : (SEASON_PRIOR_RATING * SEASON_MIN_USERS + aggregate.weightedEloSum) /
              (SEASON_MIN_USERS + aggregate.weightSum),
        winCount: aggregate.winCount,
        lossCount: aggregate.lossCount,
        biasWinCount: aggregate.biasWinCount,
        participantCount,
        comparisonCount: aggregate.comparisonCount,
        insufficientSample,
        averageElo:
          participantCount === 0 ? null : aggregate.rawEloSum / participantCount,
        imageUrl: aggregate.imageUrl
      };
    })
    .sort(compareSeasonRankingItems);
}

async function aggregateCurrentUserSeasonRanking(
  poolId: string,
  seasonId: string,
  userId: string
): Promise<SeasonPersonalRankingItem[]> {
  const poolAnime = await prisma.poolAnime.findMany({
    where: { poolId },
    select: {
      animeId: true,
      anime: {
        select: {
          title: true,
          titleCn: true,
          titleJa: true,
          imageUrl: true,
          imageMediumUrl: true,
          imageLargeUrl: true,
          cachedCoverUrl: true
        }
      }
    }
  });
  const animeById = new Map(poolAnime.map((entry) => [entry.animeId, entry.anime]));
  const activeAnimeIds = [...animeById.keys()];
  if (activeAnimeIds.length === 0) return [];

  const scores = await prisma.battleSeasonUserScore.findMany({
    where: {
      seasonId,
      userId,
      animeId: { in: activeAnimeIds },
      compareCount: { gt: 0 },
      isHidden: false
    },
    select: {
      animeId: true,
      eloScore: true,
      uncertainty: true,
      compareCount: true,
      winCount: true,
      lossCount: true,
      biasWinCount: true
    }
  });

  return scores
    .map((score) => {
      const anime = animeById.get(score.animeId);
      return {
        animeId: score.animeId,
        title: anime?.titleCn ?? anime?.titleJa ?? anime?.title ?? score.animeId,
        score: score.eloScore,
        uncertainty: score.uncertainty,
        winCount: score.winCount,
        lossCount: score.lossCount,
        biasWinCount: score.biasWinCount,
        comparisonCount: score.compareCount,
        imageUrl: anime?.cachedCoverUrl ?? anime?.imageMediumUrl ?? anime?.imageLargeUrl ?? anime?.imageUrl ?? null
      };
    })
    .sort(compareSeasonPersonalRankingItems);
}

function compareSeasonRankingItems(left: SeasonRankingItem, right: SeasonRankingItem): number {
  if (left.insufficientSample !== right.insufficientSample) {
    return left.insufficientSample ? 1 : -1;
  }
  return (
    right.score - left.score ||
    right.participantCount - left.participantCount ||
    right.comparisonCount - left.comparisonCount ||
    left.title.localeCompare(right.title) ||
    left.animeId.localeCompare(right.animeId)
  );
}

function compareSeasonPersonalRankingItems(
  left: SeasonPersonalRankingItem,
  right: SeasonPersonalRankingItem
): number {
  return (
    right.score - left.score ||
    right.comparisonCount - left.comparisonCount ||
    right.winCount - left.winCount ||
    left.title.localeCompare(right.title) ||
    left.animeId.localeCompare(right.animeId)
  );
}

export async function getSeasonMatchQueue(
  poolId: string,
  seasonId: string,
  userId: string,
  options: SeasonMatchQueueOptions = {}
): Promise<SeasonMatchQueueItem[]> {
  await getPlayableSeasonPool(poolId, userId);

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");

  validateSeasonAccess(season, new Date());

  await maybeRebuildSeasonScoresFromVotes(poolId, seasonId);
  const userScores = await ensureSeasonUserScores(prisma, poolId, seasonId, userId);
  const hiddenAnimeIds = new Set(options.hiddenAnimeIds ?? []);

  const animeIds = userScores
    .filter((score) => !score.isHidden && !hiddenAnimeIds.has(score.animeId))
    .map((score) => score.animeId);
  if (animeIds.length < 2) return [];

  const [userVotes, animes] = await Promise.all([
    prisma.battleVote.findMany({
      where: { seasonId, userId },
      select: { leftAnimeId: true, rightAnimeId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: Math.max(10, season.maxVotesPerUser)
    }),
    prisma.anime.findMany({
      where: { id: { in: animeIds } },
      select: {
        id: true,
        titleCn: true,
        titleJa: true,
        title: true,
        imageUrl: true,
        imageLargeUrl: true,
        imageMediumUrl: true,
        imageSmallUrl: true,
        cachedCoverUrl: true,
        thumbnailUrl: true,
        source: true,
        animeType: true
      }
    })
  ]);

  const animeMap = new Map(animes.map((a) => [a.id, a]));
  const scoreMap = new Map(userScores.map((score) => [score.animeId, score]));
  const comparedPairs = new Set(userVotes.map((v) => pairKey(v.leftAnimeId, v.rightAnimeId)));
  const recentPairs = new Set(
    userVotes.slice(0, 25).map((v) => pairKey(v.leftAnimeId, v.rightAnimeId))
  );
  const excludedPairs = new Set(options.excludePairKeys ?? []);
  const available = animeIds.filter((id) => animeMap.has(id) && scoreMap.has(id));
  let candidates = buildSeasonPairCandidates(available, {
    comparedPairs,
    recentPairs,
    excludedPairs,
    scoreMap,
    seed: `${seasonId}:${userId}`
  });

  if (candidates.length === 0 && excludedPairs.size > 0) {
    candidates = buildSeasonPairCandidates(available, {
      comparedPairs,
      recentPairs,
      excludedPairs: new Set(),
      scoreMap,
      seed: `${seasonId}:${userId}:fallback`
    });
  }

  const limit = Math.max(1, Math.min(20, options.limit ?? 5));

  return candidates.slice(0, limit).map(({ leftId, rightId, reason }) => {
    const left = animeMap.get(leftId)!;
    const right = animeMap.get(rightId)!;

    return {
      pairId: `${seasonId}-${pairKey(leftId, rightId)}`,
      left: toSeasonAnimeEntry(left),
      right: toSeasonAnimeEntry(right),
      reason
    };
  });
}

function buildSeasonPairCandidates(
  animeIds: string[],
  context: {
    comparedPairs: ReadonlySet<string>;
    recentPairs: ReadonlySet<string>;
    excludedPairs: ReadonlySet<string>;
    scoreMap: ReadonlyMap<string, SeasonScore>;
    seed: string;
  }
): Array<{ leftId: string; rightId: string; score: number; reason: "NEW_PAIR" | "RECALIBRATION" }> {
  const fresh: Array<{ leftId: string; rightId: string; score: number; reason: "NEW_PAIR" | "RECALIBRATION" }> = [];
  const recalibration: Array<{ leftId: string; rightId: string; score: number; reason: "NEW_PAIR" | "RECALIBRATION" }> = [];

  for (let i = 0; i < animeIds.length - 1; i++) {
    for (let j = i + 1; j < animeIds.length; j++) {
      const leftId = animeIds[i];
      const rightId = animeIds[j];
      const key = pairKey(leftId, rightId);
      if (context.excludedPairs.has(key)) continue;

      const leftScore = context.scoreMap.get(leftId);
      const rightScore = context.scoreMap.get(rightId);
      if (!leftScore || !rightScore) continue;

      const hasCompared = context.comparedPairs.has(key);
      const eloDiff = Math.abs(leftScore.eloScore - rightScore.eloScore);
      const uncertainty = leftScore.uncertainty + rightScore.uncertainty;
      const compareCount = leftScore.compareCount + rightScore.compareCount;
      const boundaryDistance = nearestSeasonBoundaryDistance(leftScore, rightScore, context.scoreMap);
      const recentPenalty = context.recentPairs.has(key) ? 8000 : 0;
      const score =
        (hasCompared ? 4000 : 0) +
        recentPenalty +
        eloDiff * 1.2 +
        compareCount * 45 -
        uncertainty * 0.35 +
        boundaryDistance * 900 +
        stablePairJitter(key, context.seed);
      const pair = {
        leftId,
        rightId,
        score,
        reason: hasCompared ? "RECALIBRATION" as const : "NEW_PAIR" as const
      };

      if (hasCompared) {
        recalibration.push(pair);
      } else {
        fresh.push(pair);
      }
    }
  }

  return [...fresh.sort((a, b) => a.score - b.score), ...recalibration.sort((a, b) => a.score - b.score)];
}

function nearestSeasonBoundaryDistance(
  left: SeasonScore,
  right: SeasonScore,
  scoreMap: ReadonlyMap<string, SeasonScore>
): number {
  const ranked = [...scoreMap.values()].sort((a, b) => b.eloScore - a.eloScore);
  const denominator = Math.max(1, ranked.length - 1);
  const percentiles = new Map<string, number>();
  ranked.forEach((score, index) => {
    percentiles.set(score.animeId, index / denominator);
  });
  const leftDistance = nearestFiveTierBoundaryDistance(percentiles.get(left.animeId) ?? 1);
  const rightDistance = nearestFiveTierBoundaryDistance(percentiles.get(right.animeId) ?? 1);
  return Math.min(leftDistance, rightDistance);
}

function nearestFiveTierBoundaryDistance(percentile: number): number {
  return Math.min(
    Math.abs(percentile - 0.1),
    Math.abs(percentile - 0.3),
    Math.abs(percentile - 0.6),
    Math.abs(percentile - 0.85)
  );
}

function toSeasonAnimeEntry(anime: {
  id: string;
  titleCn: string | null;
  titleJa: string | null;
  title: string;
  imageUrl: string | null;
  imageLargeUrl: string | null;
  imageMediumUrl: string | null;
  imageSmallUrl: string | null;
  cachedCoverUrl: string | null;
  thumbnailUrl: string | null;
  source: string;
  animeType: string | null;
}): SeasonAnimeEntry {
  return {
    animeId: anime.id,
    title: anime.titleCn ?? anime.titleJa ?? anime.title ?? anime.id,
    imageUrl: anime.cachedCoverUrl ?? anime.imageUrl,
    imageLargeUrl: anime.imageLargeUrl,
    imageMediumUrl: anime.imageMediumUrl,
    imageSmallUrl: anime.imageSmallUrl,
    cachedCoverUrl: anime.cachedCoverUrl,
    thumbnailUrl: anime.thumbnailUrl,
    source: anime.source,
    animeType: anime.animeType
  };
}

function pairKey(leftAnimeId: string, rightAnimeId: string): string {
  return [leftAnimeId, rightAnimeId].sort().join(":");
}

function stablePairJitter(pairKeyValue: string, seed: string): number {
  let hash = 0;
  const value = `${seed}:${pairKeyValue}`;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % 97;
}

async function maybeRebuildSeasonScoresFromVotes(poolId: string, seasonId: string): Promise<void> {
  const [voteCount, scoreCount] = await Promise.all([
    prisma.battleVote.count({ where: { seasonId } }),
    prisma.battleSeasonUserScore.count({ where: { seasonId } })
  ]);
  if (voteCount > 0 && scoreCount === 0) {
    await rebuildSeasonUserScoresFromVotes(poolId, seasonId);
  }
}

async function rebuildSeasonUserScoresFromVotes(poolId: string, seasonId: string): Promise<void> {
  const [poolAnime, votes] = await Promise.all([
    getPoolAnimeSeedRows(prisma, poolId),
    prisma.battleVote.findMany({
      where: { seasonId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        userId: true,
        leftAnimeId: true,
        rightAnimeId: true,
        winnerAnimeId: true,
        loserAnimeId: true,
        voteType: true,
        createdAt: true
      }
    })
  ]);

  if (votes.length === 0 || poolAnime.length === 0) return;

  const seedByAnimeId = new Map(poolAnime.map((entry) => [entry.animeId, entry.initialElo]));
  const users = [...new Set(votes.map((vote) => vote.userId))];
  const scoreMap = new Map<string, SeasonScore>();

  for (const userId of users) {
    for (const entry of poolAnime) {
      scoreMap.set(`${userId}:${entry.animeId}`, {
        seasonId,
        poolId,
        userId,
        animeId: entry.animeId,
        eloScore: entry.initialElo,
        uncertainty: SEASON_INITIAL_UNCERTAINTY,
        compareCount: 0,
        winCount: 0,
        lossCount: 0,
        biasWinCount: 0,
        unseenCount: 0,
        isHidden: false,
        lastVotedAt: null
      });
    }
  }

  for (const vote of votes) {
    if (!seedByAnimeId.has(vote.leftAnimeId) || !seedByAnimeId.has(vote.rightAnimeId)) continue;

    const left = scoreMap.get(`${vote.userId}:${vote.leftAnimeId}`);
    const right = scoreMap.get(`${vote.userId}:${vote.rightAnimeId}`);
    if (!left || !right) continue;

    const leftWon = vote.winnerAnimeId === vote.leftAnimeId;
    const elo = updateElo({
      leftElo: left.eloScore,
      rightElo: right.eloScore,
      leftCompareCount: left.compareCount,
      rightCompareCount: right.compareCount,
      leftUncertainty: left.uncertainty,
      rightUncertainty: right.uncertainty,
      result: leftWon ? "LEFT_WIN" : "RIGHT_WIN"
    });

    left.eloScore = elo.leftEloAfter;
    left.uncertainty = elo.leftUncertaintyAfter;
    left.compareCount += 1;
    left.winCount += leftWon ? 1 : 0;
    left.lossCount += leftWon ? 0 : 1;
    left.biasWinCount += vote.voteType === "BIAS" && leftWon ? 1 : 0;
    left.lastVotedAt = vote.createdAt;

    right.eloScore = elo.rightEloAfter;
    right.uncertainty = elo.rightUncertaintyAfter;
    right.compareCount += 1;
    right.winCount += leftWon ? 0 : 1;
    right.lossCount += leftWon ? 1 : 0;
    right.biasWinCount += vote.voteType === "BIAS" && !leftWon ? 1 : 0;
    right.lastVotedAt = vote.createdAt;
  }

  await prisma.$transaction([
    prisma.battleSeasonUserScore.deleteMany({ where: { seasonId } }),
    prisma.battleSeasonUserScore.createMany({
      data: [...scoreMap.values()].map((score) => ({
        seasonId: score.seasonId,
        poolId: score.poolId,
        userId: score.userId,
        animeId: score.animeId,
        eloScore: score.eloScore,
        uncertainty: score.uncertainty,
        compareCount: score.compareCount,
        winCount: score.winCount,
        lossCount: score.lossCount,
        biasWinCount: score.biasWinCount,
        unseenCount: score.unseenCount,
        isHidden: score.isHidden,
        lastVotedAt: score.lastVotedAt
      })),
      skipDuplicates: true
    })
  ]);
}

export async function setSeasonAnimeHidden(
  poolId: string,
  seasonId: string,
  userId: string,
  animeIds: string[],
  isHidden: boolean
): Promise<{ hiddenAnimeIds: string[] }> {
  await getPlayableSeasonPool(poolId, userId);

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
  validateSeasonAccess(season, new Date());

  await ensureSeasonUserScores(prisma, poolId, seasonId, userId);
  const poolAnimeIds = new Set(await getPoolAnimeIds(poolId));
  const targetAnimeIds = isHidden
    ? animeIds.filter((animeId) => poolAnimeIds.has(animeId))
    : animeIds.length > 0
      ? animeIds.filter((animeId) => poolAnimeIds.has(animeId))
      : [...poolAnimeIds];

  if (targetAnimeIds.length === 0) return { hiddenAnimeIds: [] };

  await prisma.battleSeasonUserScore.updateMany({
    where: {
      seasonId,
      userId,
      animeId: { in: targetAnimeIds }
    },
    data: isHidden
      ? {
          isHidden: true,
          unseenCount: { increment: 1 }
        }
      : {
          isHidden: false
        }
  });

  const hiddenRows = await prisma.battleSeasonUserScore.findMany({
    where: { seasonId, userId, isHidden: true },
    select: { animeId: true }
  });

  return { hiddenAnimeIds: hiddenRows.map((row) => row.animeId) };
}

function toVoteResult(vote: ExistingBattleVoteResult, maxVotesPerUser: number): VoteResult {
  return {
    id: vote.id,
    stepNumber: vote.stepNumber,
    voteType: vote.voteType,
    weight: vote.weight,
    votesRemaining: Math.max(0, maxVotesPerUser - vote.stepNumber)
  };
}

async function findExistingBattleVoteResult(
  tx: SeasonTx,
  seasonId: string,
  userId: string,
  clientMutationId: string
): Promise<ExistingBattleVoteResult | null> {
  return tx.battleVote.findFirst({
    where: { seasonId, userId, clientMutationId },
    select: {
      id: true,
      stepNumber: true,
      voteType: true,
      weight: true
    }
  });
}

export async function submitVote(
  poolId: string,
  seasonId: string,
  userId: string,
  input: VoteInput
): Promise<VoteResult> {
  await getPlayableSeasonPool(poolId, userId);

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");

  validateSeasonAccess(season, new Date());

  if (input.winnerAnimeId !== input.leftAnimeId && input.winnerAnimeId !== input.rightAnimeId) {
    throw new AppError("winnerAnimeId must be leftAnimeId or rightAnimeId", 400, "INVALID_VOTE");
  }

  const animeIds = await getPoolAnimeIds(poolId);
  if (!animeIds.includes(input.leftAnimeId) || !animeIds.includes(input.rightAnimeId)) {
    throw new AppError("Anime is not in this pool", 400, "ANIME_NOT_IN_POOL");
  }

  let voteType: "NORMAL" | "BIAS" = "NORMAL";
  let weight = 1;

  if (input.useBiasVote) {
    if (season.mode !== "BIAS") {
      throw new AppError("Bias votes are not allowed in classic mode", 400, "BIAS_NOT_ALLOWED");
    }
    voteType = "BIAS";
    weight = 2;
  }

  const loserAnimeId = input.winnerAnimeId === input.leftAnimeId ? input.rightAnimeId : input.leftAnimeId;

  for (let attempt = 1; attempt <= MAX_VOTE_WRITE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          if (input.clientMutationId) {
            const existingVote = await findExistingBattleVoteResult(tx, seasonId, userId, input.clientMutationId);
            if (existingVote) {
              return toVoteResult(existingVote, season.maxVotesPerUser);
            }
          }

          const userVotes = await tx.battleVote.count({ where: { seasonId, userId } });

          if (userVotes >= season.maxVotesPerUser) {
            throw new AppError("Vote limit reached", 400, "VOTE_LIMIT_REACHED");
          }

          if (season.maxVotesPerUserPerDay) {
            const dailyWindow = getSeasonDailyVoteWindow();
            const dailyUsed = await tx.battleVote.count({
              where: { seasonId, userId, createdAt: { gte: dailyWindow.start, lt: dailyWindow.end } }
            });
            if (dailyUsed >= season.maxVotesPerUserPerDay) {
              throw new AppError("Daily vote limit reached", 400, "DAILY_VOTE_LIMIT_REACHED");
            }
          }

          if (voteType === "BIAS") {
            const biasUsed = await tx.battleVote.count({
              where: { seasonId, userId, voteType: "BIAS" }
            });
            if (biasUsed >= season.biasVotesPerUser) {
              throw new AppError("Bias votes exhausted", 400, "BIAS_VOTES_EXHAUSTED");
            }
          }

          const scores = await ensureSeasonUserScores(tx, poolId, seasonId, userId);
          const leftScore = scores.find((score) => score.animeId === input.leftAnimeId);
          const rightScore = scores.find((score) => score.animeId === input.rightAnimeId);
          if (!leftScore || !rightScore) {
            throw new AppError("Anime is not in this pool", 400, "ANIME_NOT_IN_POOL");
          }
          if (leftScore.isHidden || rightScore.isHidden) {
            throw new AppError("Hidden anime cannot be voted", 400, "ANIME_HIDDEN");
          }

          const leftWon = input.winnerAnimeId === input.leftAnimeId;
          const elo = updateElo({
            leftElo: leftScore.eloScore,
            rightElo: rightScore.eloScore,
            leftCompareCount: leftScore.compareCount,
            rightCompareCount: rightScore.compareCount,
            leftUncertainty: leftScore.uncertainty,
            rightUncertainty: rightScore.uncertainty,
            result: leftWon ? "LEFT_WIN" : "RIGHT_WIN"
          });
          const winnerBeforeElo = leftWon ? leftScore.eloScore : rightScore.eloScore;
          const loserBeforeElo = leftWon ? rightScore.eloScore : leftScore.eloScore;
          const winnerAfterElo = leftWon ? elo.leftEloAfter : elo.rightEloAfter;
          const loserAfterElo = leftWon ? elo.rightEloAfter : elo.leftEloAfter;
          const beforeWinnerScore = Math.round(winnerBeforeElo);
          const beforeLoserScore = Math.round(loserBeforeElo);
          const afterWinnerScore = Math.round(winnerAfterElo);
          const afterLoserScore = Math.round(loserAfterElo);
          const stepNumber = userVotes + 1;
          const votedAt = new Date();

          const vote = await tx.battleVote.create({
            data: {
              seasonId,
              poolId,
              userId,
              leftAnimeId: input.leftAnimeId,
              rightAnimeId: input.rightAnimeId,
              winnerAnimeId: input.winnerAnimeId,
              loserAnimeId,
              voteType,
              weight,
              stepNumber,
              beforeWinnerScore,
              afterWinnerScore,
              beforeLoserScore,
              afterLoserScore,
              beforeWinnerElo: winnerBeforeElo,
              afterWinnerElo: winnerAfterElo,
              beforeLoserElo: loserBeforeElo,
              afterLoserElo: loserAfterElo,
              clientMutationId: input.clientMutationId ?? null,
              createdAt: votedAt
            }
          });

          await Promise.all([
            tx.battleSeasonUserScore.update({
              where: {
                seasonId_userId_animeId: {
                  seasonId,
                  userId,
                  animeId: input.leftAnimeId
                }
              },
              data: {
                eloScore: elo.leftEloAfter,
                uncertainty: elo.leftUncertaintyAfter,
                compareCount: { increment: 1 },
                winCount: leftWon ? { increment: 1 } : undefined,
                lossCount: leftWon ? undefined : { increment: 1 },
                biasWinCount: voteType === "BIAS" && leftWon ? { increment: 1 } : undefined,
                lastVotedAt: votedAt
              }
            }),
            tx.battleSeasonUserScore.update({
              where: {
                seasonId_userId_animeId: {
                  seasonId,
                  userId,
                  animeId: input.rightAnimeId
                }
              },
              data: {
                eloScore: elo.rightEloAfter,
                uncertainty: elo.rightUncertaintyAfter,
                compareCount: { increment: 1 },
                winCount: leftWon ? undefined : { increment: 1 },
                lossCount: leftWon ? { increment: 1 } : undefined,
                biasWinCount: voteType === "BIAS" && !leftWon ? { increment: 1 } : undefined,
                lastVotedAt: votedAt
              }
            })
          ]);

          return {
            id: vote.id,
            stepNumber: vote.stepNumber,
            voteType: vote.voteType,
            weight: vote.weight,
            votesRemaining: Math.max(0, season.maxVotesPerUser - stepNumber)
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (isClientMutationConflict(error) && input.clientMutationId) {
        const existingVote = await prisma.battleVote.findFirst({
          where: { seasonId, userId, clientMutationId: input.clientMutationId },
          select: {
            id: true,
            stepNumber: true,
            voteType: true,
            weight: true
          }
        });
        if (existingVote) {
          return toVoteResult(existingVote, season.maxVotesPerUser);
        }
      }
      if (isRetryableVoteWriteError(error) && attempt < MAX_VOTE_WRITE_ATTEMPTS) {
        await sleep(VOTE_WRITE_RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      if (isRetryableVoteWriteError(error)) {
        throw new AppError("Vote is being processed, please retry", 409, "VOTE_WRITE_CONFLICT");
      }
      throw error;
    }
  }

  throw new AppError("Vote is being processed, please retry", 409, "VOTE_WRITE_CONFLICT");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableVoteWriteError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

function isClientMutationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  return Array.isArray(target) && target.includes("clientMutationId");
}

export async function updateSeason(
  poolId: string,
  seasonId: string,
  userId: string,
  input: SeasonUpdateInput
): Promise<BattleSeason> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");

  if (season.status === "ENDED") {
    throw new AppError("Ended seasons cannot be edited", 400, "SEASON_ENDED");
  }

  const normalized = normalizeSeasonUpdateInput(input);

  return prisma.battleSeason.update({
    where: { id: seasonId },
    data: {
      title: normalized.title,
      description: normalized.description,
      mode: normalized.mode,
      startsAt: normalized.startsAt,
      endsAt: normalized.endsAt,
      maxVotesPerUser: normalized.maxVotesPerUser,
      maxVotesPerUserPerDay: normalized.maxVotesPerUserPerDay,
      biasVotesPerUser: normalized.biasVotesPerUser
    }
  });
}

export async function deleteSeason(
  poolId: string,
  seasonId: string,
  userId: string
): Promise<{ id: string }> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");

  await prisma.battleSeason.delete({
    where: { id: seasonId }
  });

  return { id: seasonId };
}

export async function startSeason(
  poolId: string,
  seasonId: string,
  userId: string
): Promise<BattleSeason> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
  if (season.status === "ENDED") throw new AppError("Ended seasons cannot be restarted", 400, "SEASON_ENDED");
  if (season.status === "ACTIVE") throw new AppError("Season is already active", 400, "SEASON_ALREADY_ACTIVE");

  return prisma.battleSeason.update({
    where: { id: seasonId },
    data: {
      status: "ACTIVE",
      startsAt: new Date()
    }
  });
}

export async function endSeason(
  poolId: string,
  seasonId: string,
  userId: string
): Promise<BattleSeason> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("Season not found", 404, "SEASON_NOT_FOUND");
  if (season.status !== "ACTIVE") throw new AppError("Season is not active", 400, "SEASON_NOT_ACTIVE");

  return prisma.battleSeason.update({
    where: { id: seasonId },
    data: {
      status: "ENDED",
      endsAt: new Date()
    }
  });
}
