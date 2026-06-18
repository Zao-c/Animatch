import { prisma } from "./db";
import { AppError } from "./app-error";
import { canEditPoolContent } from "./pool-permissions";
import { getAnimeCoverUrl } from "./anime-cover-url";
import { Prisma, type BattleSeason, type BattleSeasonMode } from "@prisma/client";

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
  description?: string;
  mode?: SeasonMode;
  startsAt?: Date;
  endsAt?: Date;
  maxVotesPerUser?: number;
  maxVotesPerUserPerDay?: number;
  biasVotesPerUser?: number;
}

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
  recentVotes: RecentVoteEntry[];
  currentUserState: CurrentUserState | null;
  createdAt: string;
}

export interface SeasonRankingItem {
  animeId: string;
  title: string;
  score: number;
  winCount: number;
  lossCount: number;
  biasWinCount: number;
  imageUrl: string | null;
}

export interface RecentVoteEntry {
  stepNumber: number;
  username: string;
  displayName: string;
  winnerTitle: string;
  loserTitle: string;
  voteType: string;
  weight: number;
  createdAt: string;
}

export interface CurrentUserState {
  votesUsed: number;
  votesRemaining: number;
  biasVotesUsed: number;
  biasVotesRemaining: number;
  dailyVotesUsed?: number;
}

export interface SeasonMatchQueueItem {
  pairId: string;
  left: SeasonAnimeEntry;
  right: SeasonAnimeEntry;
}

export interface SeasonAnimeEntry {
  animeId: string;
  title: string;
  imageUrl: string | null;
  imageLargeUrl: string | null;
  imageMediumUrl: string | null;
  imageSmallUrl: string | null;
  thumbnailUrl: string | null;
  source: string;
  animeType: string | null;
}

export interface VoteInput {
  leftAnimeId: string;
  rightAnimeId: string;
  winnerAnimeId: string;
  useBiasVote?: boolean;
}

export interface VoteResult {
  id: string;
  stepNumber: number;
  voteType: string;
  weight: number;
  votesRemaining: number;
}

const MAX_VOTE_WRITE_ATTEMPTS = 3;

async function getPoolAnimeIds(poolId: string): Promise<string[]> {
  const entries = await prisma.poolAnime.findMany({
    where: { poolId },
    select: { animeId: true }
  });
  return entries.map((e) => e.animeId);
}

function validateSeasonAccess(season: BattleSeason, now: Date): void {
  if (season.status === "DRAFT") {
    throw new AppError("赛季尚未开始", 400, "SEASON_NOT_ACTIVE");
  }
  if (season.status === "ENDED") {
    throw new AppError("赛季已结束", 400, "SEASON_ENDED");
  }
  if (now < season.startsAt) {
    throw new AppError("赛季尚未开始", 400, "SEASON_NOT_STARTED");
  }
  if (season.endsAt && now > season.endsAt) {
    throw new AppError("赛季已结束", 400, "SEASON_ENDED");
  }
}

export async function createSeason(
  poolId: string,
  userId: string,
  input: SeasonCreateInput
): Promise<BattleSeason> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("番组不存在", 404, "POOL_NOT_FOUND");
  if (pool.status === "ARCHIVED") throw new AppError("已归档的番组不能创建赛季", 400, "POOL_ARCHIVED");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("你没有权限创建赛季", 403, "FORBIDDEN");
  }

  return prisma.battleSeason.create({
    data: {
      poolId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      mode: input.mode,
      startsAt: input.startsAt ?? new Date(),
      endsAt: input.endsAt ?? null,
      maxVotesPerUser: input.maxVotesPerUser ?? 50,
      maxVotesPerUserPerDay: input.maxVotesPerUserPerDay ?? null,
      biasVotesPerUser: input.biasVotesPerUser ?? 3,
      createdByUserId: userId
    }
  });
}

export async function listSeasons(poolId: string, userId: string | null): Promise<SeasonListItem[]> {
  const pool = await prisma.customPool.findUnique({
    where: { id: poolId },
    select: { creatorId: true, isOfficialDemo: true, allowPublicEdit: true, deletedAt: true }
  });
  if (!pool || pool.deletedAt) throw new AppError("番组不存在", 404, "POOL_NOT_FOUND");

  const seasons = await prisma.battleSeason.findMany({
    where: { poolId },
    include: {
      _count: { select: { votes: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const participantCounts = await prisma.battleVote.groupBy({
    by: ["seasonId"],
    _count: { userId: true },
    where: { seasonId: { in: seasons.map((s) => s.id) } }
  });

  const pcMap = new Map(participantCounts.map((p) => [p.seasonId, p._count.userId]));

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
    participantCount: pcMap.get(s.id) ?? 0,
    totalVotes: s._count.votes,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt)
  }));
}

export async function getSeasonDetail(
  poolId: string,
  seasonId: string,
  userId: string | null
): Promise<SeasonDetail> {
  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("赛季不存在", 404, "SEASON_NOT_FOUND");

  const [participantCount, totalVotes, biasCount, recentVotesRaw, scoresRaw] = await Promise.all([
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
      orderBy: { stepNumber: "desc" },
      take: 20
    }),
    prisma.battleVote.groupBy({
      by: ["winnerAnimeId"],
      where: { seasonId },
      _sum: { weight: true },
      _count: { winnerAnimeId: true }
    })
  ]);

  const lossScores = await prisma.battleVote.groupBy({
    by: ["loserAnimeId"],
    where: { seasonId },
    _sum: { weight: true },
    _count: { loserAnimeId: true }
  });

  const scoreMap = new Map<string, { score: number; wins: number; losses: number; biasWins: number }>();
  for (const s of scoresRaw) {
    scoreMap.set(s.winnerAnimeId, {
      score: s._sum.weight ?? 0,
      wins: s._count.winnerAnimeId,
      losses: 0,
      biasWins: 0
    });
  }
  for (const l of lossScores) {
    const existing = scoreMap.get(l.loserAnimeId) ?? { score: 0, wins: 0, losses: 0, biasWins: 0 };
    existing.score -= (l._sum.weight ?? 0);
    existing.losses = l._count.loserAnimeId;
    scoreMap.set(l.loserAnimeId, existing);
  }

  const biasWins = await prisma.battleVote.groupBy({
    by: ["winnerAnimeId"],
    where: { seasonId, voteType: "BIAS" },
    _count: true
  });
  for (const b of biasWins) {
    const existing = scoreMap.get(b.winnerAnimeId);
    if (existing) existing.biasWins = b._count;
  }

  const allAnimeIds = [...scoreMap.keys()];
  const animes = await prisma.anime.findMany({
    where: { id: { in: allAnimeIds } },
    select: {
      id: true,
      titleCn: true,
      titleJa: true,
      title: true,
      imageUrl: true,
      imageMediumUrl: true,
      imageLargeUrl: true
    }
  });

  const animeMap = new Map(animes.map((a) => [a.id, a]));

  const ranking: SeasonRankingItem[] = [...scoreMap.entries()]
    .map(([animeId, data]) => {
      const anime = animeMap.get(animeId);
      return {
        animeId,
        title: anime?.titleCn ?? anime?.titleJa ?? anime?.title ?? animeId,
        score: data.score,
        winCount: data.wins,
        lossCount: data.losses,
        biasWinCount: data.biasWins,
        imageUrl: anime ? (anime.imageMediumUrl ?? anime.imageLargeUrl ?? anime.imageUrl) : null
      };
    })
    .sort((a, b) => b.score - a.score);

  const recentVotes: RecentVoteEntry[] = await Promise.all(
    recentVotesRaw.map(async (v) => {
      const [winner, loser] = await Promise.all([
        prisma.anime.findUnique({ where: { id: v.winnerAnimeId }, select: { titleCn: true, titleJa: true, title: true } }),
        prisma.anime.findUnique({ where: { id: v.loserAnimeId }, select: { titleCn: true, titleJa: true, title: true } })
      ]);
      return {
        stepNumber: v.stepNumber,
        username: v.user.username ?? "unknown",
        displayName: v.user.name ?? v.user.username ?? "unknown",
        winnerTitle: winner?.titleCn ?? winner?.titleJa ?? winner?.title ?? v.winnerAnimeId,
        loserTitle: loser?.titleCn ?? loser?.titleJa ?? loser?.title ?? v.loserAnimeId,
        voteType: v.voteType,
        weight: v.weight,
        createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt)
      };
    })
  );

  let currentUserState: CurrentUserState | null = null;
  if (userId) {
    const userVotes = await prisma.battleVote.count({
      where: { seasonId, userId }
    });
    const biasUsed = await prisma.battleVote.count({
      where: { seasonId, userId, voteType: "BIAS" }
    });

    let dailyUsed: number | undefined = undefined;
    if (season.maxVotesPerUserPerDay) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dailyUsed = await prisma.battleVote.count({
        where: {
          seasonId,
          userId,
          createdAt: { gte: today, lt: tomorrow }
        }
      });
    }

    currentUserState = {
      votesUsed: userVotes,
      votesRemaining: Math.max(0, season.maxVotesPerUser - userVotes),
      biasVotesUsed: biasUsed,
      biasVotesRemaining: Math.max(0, season.biasVotesPerUser - biasUsed),
      dailyVotesUsed: dailyUsed
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
    recentVotes,
    currentUserState,
    createdAt: season.createdAt instanceof Date ? season.createdAt.toISOString() : String(season.createdAt)
  };
}

export async function getSeasonMatchQueue(
  poolId: string,
  seasonId: string,
  userId: string
): Promise<SeasonMatchQueueItem[]> {
  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("赛季不存在", 404, "SEASON_NOT_FOUND");

  validateSeasonAccess(season, new Date());

  const animeIds = await getPoolAnimeIds(poolId);
  if (animeIds.length < 2) return [];

  const [userVotes, leftExposure, rightExposure, animes] = await Promise.all([
    prisma.battleVote.findMany({
      where: { seasonId, userId },
      select: { leftAnimeId: true, rightAnimeId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: Math.max(10, season.maxVotesPerUser)
    }),
    prisma.battleVote.groupBy({
      by: ["leftAnimeId"],
      where: { seasonId },
      _count: { leftAnimeId: true }
    }),
    prisma.battleVote.groupBy({
      by: ["rightAnimeId"],
      where: { seasonId },
      _count: { rightAnimeId: true }
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
        thumbnailUrl: true,
        source: true,
        animeType: true
      }
    })
  ]);

  const recentPairs = new Set(userVotes.map((v) => pairKey(v.leftAnimeId, v.rightAnimeId)));
  const userSeenAnimeIds = new Set(
    userVotes.flatMap((vote) => [vote.leftAnimeId, vote.rightAnimeId])
  );
  const exposureCount = new Map<string, number>();
  for (const item of leftExposure) {
    exposureCount.set(item.leftAnimeId, (exposureCount.get(item.leftAnimeId) ?? 0) + item._count.leftAnimeId);
  }
  for (const item of rightExposure) {
    exposureCount.set(item.rightAnimeId, (exposureCount.get(item.rightAnimeId) ?? 0) + item._count.rightAnimeId);
  }

  const animeMap = new Map(animes.map((a) => [a.id, a]));
  const available = animeIds.filter((id) => animeMap.has(id));
  const candidates = buildSeasonPairCandidates(available, {
    recentPairs,
    userSeenAnimeIds,
    exposureCount,
    seed: `${seasonId}:${userId}`
  });

  return candidates.slice(0, 5).map(({ leftId, rightId }, index) => {
    const left = animeMap.get(leftId)!;
    const right = animeMap.get(rightId)!;

    return {
      pairId: `${seasonId}-${pairKey(leftId, rightId)}-${index}`,
      left: toSeasonAnimeEntry(left),
      right: toSeasonAnimeEntry(right)
    };
  });
}

function buildSeasonPairCandidates(
  animeIds: string[],
  context: {
    recentPairs: ReadonlySet<string>;
    userSeenAnimeIds: ReadonlySet<string>;
    exposureCount: ReadonlyMap<string, number>;
    seed: string;
  }
): Array<{ leftId: string; rightId: string; score: number }> {
  const unseenFirst: Array<{ leftId: string; rightId: string; score: number }> = [];
  const fallback: Array<{ leftId: string; rightId: string; score: number }> = [];

  for (let i = 0; i < animeIds.length - 1; i++) {
    for (let j = i + 1; j < animeIds.length; j++) {
      const leftId = animeIds[i];
      const rightId = animeIds[j];
      const key = pairKey(leftId, rightId);
      const leftSeen = context.userSeenAnimeIds.has(leftId) ? 1 : 0;
      const rightSeen = context.userSeenAnimeIds.has(rightId) ? 1 : 0;
      const seenPenalty = leftSeen + rightSeen;
      const exposure =
        (context.exposureCount.get(leftId) ?? 0) + (context.exposureCount.get(rightId) ?? 0);
      const score = seenPenalty * 10000 + exposure * 100 + stablePairJitter(key, context.seed);
      const pair = { leftId, rightId, score };

      if (context.recentPairs.has(key)) {
        fallback.push({ ...pair, score: score + 50000 });
      } else {
        unseenFirst.push(pair);
      }
    }
  }

  return [...unseenFirst, ...fallback].sort((a, b) => a.score - b.score);
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
  thumbnailUrl: string | null;
  source: string;
  animeType: string | null;
}): SeasonAnimeEntry {
  return {
    animeId: anime.id,
    title: anime.titleCn ?? anime.titleJa ?? anime.title ?? anime.id,
    imageUrl: anime.imageUrl,
    imageLargeUrl: anime.imageLargeUrl,
    imageMediumUrl: anime.imageMediumUrl,
    imageSmallUrl: anime.imageSmallUrl,
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

export async function submitVote(
  poolId: string,
  seasonId: string,
  userId: string,
  input: VoteInput
): Promise<VoteResult> {
  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("赛季不存在", 404, "SEASON_NOT_FOUND");

  validateSeasonAccess(season, new Date());

  if (input.winnerAnimeId !== input.leftAnimeId && input.winnerAnimeId !== input.rightAnimeId) {
    throw new AppError("winnerAnimeId 必须是 leftAnimeId 或 rightAnimeId", 400, "INVALID_VOTE");
  }

  const animeIds = await getPoolAnimeIds(poolId);
  if (!animeIds.includes(input.leftAnimeId) || !animeIds.includes(input.rightAnimeId)) {
    throw new AppError("作品不在当前番组中", 400, "ANIME_NOT_IN_POOL");
  }

  let voteType: "NORMAL" | "BIAS" = "NORMAL";
  let weight = 1;

  if (input.useBiasVote) {
    if (season.mode !== "BIAS") {
      throw new AppError("传统模式不能使用私心票", 400, "BIAS_NOT_ALLOWED");
    }
    voteType = "BIAS";
    weight = 2;
  }

  const loserAnimeId = input.winnerAnimeId === input.leftAnimeId ? input.rightAnimeId : input.leftAnimeId;

  for (let attempt = 1; attempt <= MAX_VOTE_WRITE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const userVotes = await tx.battleVote.count({ where: { seasonId, userId } });

          if (userVotes >= season.maxVotesPerUser) {
            throw new AppError("已达到最大投票次数", 400, "VOTE_LIMIT_REACHED");
          }

          if (season.maxVotesPerUserPerDay) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dailyUsed = await tx.battleVote.count({
              where: { seasonId, userId, createdAt: { gte: today, lt: tomorrow } }
            });
            if (dailyUsed >= season.maxVotesPerUserPerDay) {
              throw new AppError("今日投票次数已用完", 400, "DAILY_VOTE_LIMIT_REACHED");
            }
          }

          if (voteType === "BIAS") {
            const biasUsed = await tx.battleVote.count({
              where: { seasonId, userId, voteType: "BIAS" }
            });
            if (biasUsed >= season.biasVotesPerUser) {
              throw new AppError("私心票已用完", 400, "BIAS_VOTES_EXHAUSTED");
            }
          }

          const [beforeWinnerScoreRaw, beforeLoserLosses] = await Promise.all([
            tx.battleVote.aggregate({
              where: { seasonId, winnerAnimeId: input.winnerAnimeId },
              _sum: { weight: true }
            }),
            tx.battleVote.aggregate({
              where: { seasonId, loserAnimeId },
              _sum: { weight: true }
            })
          ]);

          const beforeWinnerScore = beforeWinnerScoreRaw._sum.weight ?? 0;
          const beforeLoserScore = 0 - (beforeLoserLosses._sum.weight ?? 0);
          const afterWinnerScore = beforeWinnerScore + weight;
          const stepNumber = userVotes + 1;

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
              afterLoserScore: beforeLoserScore
            }
          });

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
      if (isRetryableVoteWriteError(error) && attempt < MAX_VOTE_WRITE_ATTEMPTS) {
        continue;
      }
      if (isRetryableVoteWriteError(error)) {
        throw new AppError("投票正在处理中，请稍后重试", 409, "VOTE_WRITE_CONFLICT");
      }
      throw error;
    }
  }

  throw new AppError("投票正在处理中，请稍后重试", 409, "VOTE_WRITE_CONFLICT");
}

function isRetryableVoteWriteError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

export async function updateSeason(
  poolId: string,
  seasonId: string,
  userId: string,
  input: SeasonUpdateInput
): Promise<BattleSeason> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("番组不存在", 404, "POOL_NOT_FOUND");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("你没有权限编辑赛季", 403, "FORBIDDEN");
  }

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("赛季不存在", 404, "SEASON_NOT_FOUND");

  if (season.status === "ENDED") {
    throw new AppError("已结束的赛季不能编辑", 400, "SEASON_ENDED");
  }

  return prisma.battleSeason.update({
    where: { id: seasonId },
    data: {
      title: input.title?.trim(),
      description: input.description?.trim(),
      mode: input.mode,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      maxVotesPerUser: input.maxVotesPerUser,
      maxVotesPerUserPerDay: input.maxVotesPerUserPerDay,
      biasVotesPerUser: input.biasVotesPerUser
    }
  });
}

export async function startSeason(
  poolId: string,
  seasonId: string,
  userId: string
): Promise<BattleSeason> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) throw new AppError("番组不存在", 404, "POOL_NOT_FOUND");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("你没有权限管理赛季", 403, "FORBIDDEN");
  }

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("赛季不存在", 404, "SEASON_NOT_FOUND");
  if (season.status === "ENDED") throw new AppError("已结束的赛季不能重新开始", 400, "SEASON_ENDED");
  if (season.status === "ACTIVE") throw new AppError("赛季已在进行中", 400, "SEASON_ALREADY_ACTIVE");

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
  if (!pool || pool.deletedAt) throw new AppError("番组不存在", 404, "POOL_NOT_FOUND");

  if (!canEditPoolContent(pool, { id: userId })) {
    throw new AppError("你没有权限管理赛季", 403, "FORBIDDEN");
  }

  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId }
  });
  if (!season) throw new AppError("赛季不存在", 404, "SEASON_NOT_FOUND");
  if (season.status !== "ACTIVE") throw new AppError("赛季未在运行中", 400, "SEASON_NOT_ACTIVE");

  return prisma.battleSeason.update({
    where: { id: seasonId },
    data: {
      status: "ENDED",
      endsAt: new Date()
    }
  });
}
