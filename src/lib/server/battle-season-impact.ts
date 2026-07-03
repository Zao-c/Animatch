import { prisma } from "@/lib/db";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import type { Anime } from "@prisma/client";

interface VoteRecord {
  id: string;
  stepNumber: number;
  userId: string;
  winnerAnimeId: string;
  loserAnimeId: string;
  voteType: "NORMAL" | "BIAS";
  weight: number;
  beforeWinnerScore: number;
  afterWinnerScore: number;
  beforeLoserScore: number;
  afterLoserScore: number;
  beforeWinnerElo: number | null;
  afterWinnerElo: number | null;
  beforeLoserElo: number | null;
  afterLoserElo: number | null;
  createdAt: Date;
  user: { id: string; username: string | null; name: string | null; image: string | null };
  winnerAnime: Pick<Anime, "id" | "title" | "titleCn" | "titleJa" | "imageUrl" | "imageMediumUrl" | "imageLargeUrl" | "cachedCoverUrl"> | null;
  loserAnime: Pick<Anime, "id" | "title" | "titleCn" | "titleJa" | "imageUrl" | "imageMediumUrl" | "imageLargeUrl" | "cachedCoverUrl"> | null;
}

export interface UserImpactEntry {
  userId: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
  voteCount: number;
  normalVoteCount: number;
  biasVoteCount: number;
  totalWeight: number;
  totalScoreSwing: number;
  supportedAnimeTop3: { animeId: string; title: string; supportScore: number }[];
  suppressedAnimeTop3: { animeId: string; title: string; suppressionScore: number }[];
}

export interface AnimeSupportEntry {
  animeId: string;
  title: string;
  coverUrl: string | null;
  supportScore: number;
  supportVoteCount: number;
  topSupporters: { userId: string; displayName: string | null; weight: number }[];
}

export interface AnimeSuppressionEntry {
  animeId: string;
  title: string;
  coverUrl: string | null;
  suppressionScore: number;
  suppressionVoteCount: number;
  topSuppressors: { userId: string; displayName: string | null; weight: number }[];
}

export interface KeyVoteEntry {
  id: string;
  stepNumber: number;
  userId: string;
  displayName: string | null;
  winnerTitle: string;
  loserTitle: string;
  voteType: "NORMAL" | "BIAS";
  weight: number;
  winnerScoreDelta: number;
  loserScoreDelta: number;
  totalSwing: number;
  createdAt: string;
}

export interface BiasVoteStats {
  totalBiasVotes: number;
  biasUsersCount: number;
  topBiasUsers: { userId: string; displayName: string | null; biasCount: number }[];
  topBiasSupportedAnime: { animeId: string; title: string; biasWinCount: number }[];
}

export interface BattleSeasonImpact {
  season: {
    id: string;
    title: string;
    mode: string;
    status: string;
  };
  stats: {
    totalVotes: number;
    totalParticipants: number;
    totalBiasVotes: number;
    totalScoreSwing: number;
    topInfluencerUser: { userId: string; displayName: string | null } | null;
    mostSupportedAnime: { animeId: string; title: string } | null;
    mostSuppressedAnime: { animeId: string; title: string } | null;
  };
  userImpactRanking: UserImpactEntry[];
  animeSupportRanking: AnimeSupportEntry[];
  animeSuppressionRanking: AnimeSuppressionEntry[];
  keyVotes: KeyVoteEntry[];
  biasVoteStats: BiasVoteStats | null;
  currentUserImpact: UserImpactEntry | null;
}

function computeSwing(v: VoteRecord): number {
  const wd = winnerDelta(v);
  const ld = loserDelta(v);
  if (wd !== 0 || ld !== 0) {
    return Math.abs(wd) + Math.abs(ld);
  }
  return v.weight * 2;
}

function winnerDelta(v: VoteRecord): number {
  if (v.afterWinnerElo !== null && v.beforeWinnerElo !== null) {
    return v.afterWinnerElo - v.beforeWinnerElo;
  }
  return v.afterWinnerScore - v.beforeWinnerScore;
}

function loserDelta(v: VoteRecord): number {
  if (v.afterLoserElo !== null && v.beforeLoserElo !== null) {
    return v.afterLoserElo - v.beforeLoserElo;
  }
  return v.afterLoserScore - v.beforeLoserScore;
}

function animeTitle(a: Pick<Anime, "title" | "titleCn" | "titleJa"> | null): string {
  if (!a) return "未知作品";
  return a.titleCn ?? a.titleJa ?? a.title ?? "未知作品";
}

function animeCover(a: Pick<Anime, "title" | "titleCn" | "titleJa" | "imageUrl" | "imageMediumUrl" | "imageLargeUrl" | "cachedCoverUrl"> | null): string | null {
  if (!a) return null;
  return getAnimeCoverUrl({
    imageUrl: a.imageUrl,
    imageMediumUrl: a.imageMediumUrl,
    imageLargeUrl: a.imageLargeUrl,
    cachedCoverUrl: a.cachedCoverUrl,
  }, { intent: "display" });
}

export async function getBattleSeasonImpact(
  poolId: string,
  seasonId: string,
  currentUserId?: string | null
): Promise<BattleSeasonImpact> {
  const season = await prisma.battleSeason.findFirst({
    where: { id: seasonId, poolId },
    select: { id: true, title: true, mode: true, status: true },
  });
  if (!season) throw new Error("SEASON_NOT_FOUND");

  const rawVotes = await prisma.battleVote.findMany({
    where: { seasonId },
    include: {
      user: { select: { id: true, username: true, name: true, image: true } },
    },
    orderBy: { stepNumber: "desc" },
  });

  const winnerAnimeIds = [...new Set(rawVotes.map((v) => v.winnerAnimeId))];
  const loserAnimeIds = [...new Set(rawVotes.map((v) => v.loserAnimeId))];
  const allAnimeIds = [...new Set([...winnerAnimeIds, ...loserAnimeIds])];

  const animes = await prisma.anime.findMany({
    where: { id: { in: allAnimeIds } },
    select: { id: true, title: true, titleCn: true, titleJa: true, imageUrl: true, imageMediumUrl: true, imageLargeUrl: true, cachedCoverUrl: true },
  });
  const animeMap = new Map(animes.map((a) => [a.id, a]));

  const votes: VoteRecord[] = rawVotes.map((v) => ({
    id: v.id,
    stepNumber: v.stepNumber,
    userId: v.userId,
    winnerAnimeId: v.winnerAnimeId,
    loserAnimeId: v.loserAnimeId,
    voteType: v.voteType as "NORMAL" | "BIAS",
    weight: v.weight,
    beforeWinnerScore: v.beforeWinnerScore,
    afterWinnerScore: v.afterWinnerScore,
    beforeLoserScore: v.beforeLoserScore,
    afterLoserScore: v.afterLoserScore,
    beforeWinnerElo: v.beforeWinnerElo,
    afterWinnerElo: v.afterWinnerElo,
    beforeLoserElo: v.beforeLoserElo,
    afterLoserElo: v.afterLoserElo,
    createdAt: v.createdAt,
    user: {
      id: v.user.id,
      username: v.user.username,
      name: v.user.name,
      image: v.user.image,
    },
    winnerAnime: animeMap.get(v.winnerAnimeId) ?? null,
    loserAnime: animeMap.get(v.loserAnimeId) ?? null,
  }));

  if (votes.length === 0) {
    return createEmptyImpact(season);
  }

  const userMap = new Map<string, UserImpactEntry>();
  const animeSupportMap = new Map<string, { supportScore: number; supportVoteCount: number; supporters: Map<string, number> }>();
  const animeSuppressionMap = new Map<string, { suppressionScore: number; suppressionVoteCount: number; suppressors: Map<string, number> }>();
  const animeTitles = new Map<string, string>();
  const animeCovers = new Map<string, string | null>();
  const userDetails = new Map<string, { username: string | null; displayName: string | null; image: string | null }>();
  const biasWinnerCount = new Map<string, number>();
  const keyVotesList: { vote: VoteRecord; swing: number }[] = [];
  let totalBiasVotes = 0;
  const biasUserMap = new Map<string, number>();

  for (const v of votes) {
    const swing = computeSwing(v);
    const userName = v.user.name ?? v.user.username ?? "unknown";
    const winnerTitle = animeTitle(v.winnerAnime);
    const loserTitle = animeTitle(v.loserAnime);

    if (!animeTitles.has(v.winnerAnimeId)) {
      animeTitles.set(v.winnerAnimeId, winnerTitle);
      animeCovers.set(v.winnerAnimeId, animeCover(v.winnerAnime));
    }
    if (!animeTitles.has(v.loserAnimeId)) {
      animeTitles.set(v.loserAnimeId, loserTitle);
      animeCovers.set(v.loserAnimeId, animeCover(v.loserAnime));
    }
    if (!userDetails.has(v.userId)) {
      userDetails.set(v.userId, { username: v.user.username, displayName: userName, image: v.user.image });
    }

    let ue = userMap.get(v.userId);
    if (!ue) {
      ue = {
        userId: v.userId,
        username: v.user.username,
        displayName: userName,
        image: v.user.image,
        voteCount: 0,
        normalVoteCount: 0,
        biasVoteCount: 0,
        totalWeight: 0,
        totalScoreSwing: 0,
        supportedAnimeTop3: [],
        suppressedAnimeTop3: [],
      };
      userMap.set(v.userId, ue);
    }

    ue.voteCount++;
    ue.totalWeight += v.weight;
    ue.totalScoreSwing += swing;

    if (v.voteType === "BIAS") {
      ue.biasVoteCount++;
      totalBiasVotes++;
      biasUserMap.set(v.userId, (biasUserMap.get(v.userId) ?? 0) + 1);
      biasWinnerCount.set(v.winnerAnimeId, (biasWinnerCount.get(v.winnerAnimeId) ?? 0) + 1);
    } else {
      ue.normalVoteCount++;
    }

    let sup = animeSupportMap.get(v.winnerAnimeId);
    if (!sup) {
      sup = { supportScore: 0, supportVoteCount: 0, supporters: new Map() };
      animeSupportMap.set(v.winnerAnimeId, sup);
    }
    sup.supportScore += v.weight;
    sup.supportVoteCount++;
    sup.supporters.set(v.userId, (sup.supporters.get(v.userId) ?? 0) + v.weight);

    let sup2 = animeSuppressionMap.get(v.loserAnimeId);
    if (!sup2) {
      sup2 = { suppressionScore: 0, suppressionVoteCount: 0, suppressors: new Map() };
      animeSuppressionMap.set(v.loserAnimeId, sup2);
    }
    sup2.suppressionScore += v.weight;
    sup2.suppressionVoteCount++;
    sup2.suppressors.set(v.userId, (sup2.suppressors.get(v.userId) ?? 0) + v.weight);

    keyVotesList.push({ vote: v, swing });
  }

  const userImpactRanking = Array.from(userMap.values())
    .sort((a, b) => b.totalScoreSwing - a.totalScoreSwing);

  for (const ue of userImpactRanking) {
    const userVotes = votes.filter((v) => v.userId === ue.userId);

    const supportMap = new Map<string, number>();
    const suppressMap = new Map<string, number>();
    for (const v of userVotes) {
      supportMap.set(v.winnerAnimeId, (supportMap.get(v.winnerAnimeId) ?? 0) + v.weight);
      suppressMap.set(v.loserAnimeId, (suppressMap.get(v.loserAnimeId) ?? 0) + v.weight);
    }

    ue.supportedAnimeTop3 = Array.from(supportMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([animeId, score]) => ({ animeId, title: animeTitles.get(animeId) ?? "未知", supportScore: score }));

    ue.suppressedAnimeTop3 = Array.from(suppressMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([animeId, score]) => ({ animeId, title: animeTitles.get(animeId) ?? "未知", suppressionScore: score }));
  }

  const animeSupportRanking = Array.from(animeSupportMap.entries())
    .map(([animeId, data]) => ({
      animeId,
      title: animeTitles.get(animeId) ?? "未知",
      coverUrl: animeCovers.get(animeId) ?? null,
      supportScore: data.supportScore,
      supportVoteCount: data.supportVoteCount,
      topSupporters: Array.from(data.supporters.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([userId, weight]) => ({ userId, displayName: userDetails.get(userId)?.displayName ?? null, weight })),
    }))
    .sort((a, b) => b.supportScore - a.supportScore);

  const animeSuppressionRanking = Array.from(animeSuppressionMap.entries())
    .map(([animeId, data]) => ({
      animeId,
      title: animeTitles.get(animeId) ?? "未知",
      coverUrl: animeCovers.get(animeId) ?? null,
      suppressionScore: data.suppressionScore,
      suppressionVoteCount: data.suppressionVoteCount,
      topSuppressors: Array.from(data.suppressors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([userId, weight]) => ({ userId, displayName: userDetails.get(userId)?.displayName ?? null, weight })),
    }))
    .sort((a, b) => b.suppressionScore - a.suppressionScore);

  const keyVotes = keyVotesList
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 20)
    .map(({ vote: v, swing }) => ({
      id: v.id,
      stepNumber: v.stepNumber,
      userId: v.userId,
      displayName: userDetails.get(v.userId)?.displayName ?? null,
      winnerTitle: animeTitles.get(v.winnerAnimeId) ?? "未知",
      loserTitle: animeTitles.get(v.loserAnimeId) ?? "未知",
      voteType: v.voteType,
      weight: v.weight,
      winnerScoreDelta: winnerDelta(v),
      loserScoreDelta: loserDelta(v),
      totalSwing: swing,
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
    }));

  const biasVoteStats: BiasVoteStats | null = totalBiasVotes > 0 ? {
    totalBiasVotes,
    biasUsersCount: biasUserMap.size,
    topBiasUsers: Array.from(biasUserMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, biasCount]) => ({ userId, displayName: userDetails.get(userId)?.displayName ?? null, biasCount })),
    topBiasSupportedAnime: Array.from(biasWinnerCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([animeId, biasWinCount]) => ({ animeId, title: animeTitles.get(animeId) ?? "未知", biasWinCount })),
  } : null;

  const totalScoreSwing = keyVotesList.reduce((sum, kv) => sum + kv.swing, 0);

  let currentUserImpact: UserImpactEntry | null = null;
  if (currentUserId) {
    currentUserImpact = userImpactRanking.find((u) => u.userId === currentUserId) ?? {
      userId: currentUserId,
      username: null,
      displayName: null,
      image: null,
      voteCount: 0,
      normalVoteCount: 0,
      biasVoteCount: 0,
      totalWeight: 0,
      totalScoreSwing: 0,
      supportedAnimeTop3: [],
      suppressedAnimeTop3: [],
    };
  }

  return {
    season: { id: season.id, title: season.title, mode: season.mode, status: season.status },
    stats: {
      totalVotes: votes.length,
      totalParticipants: userMap.size,
      totalBiasVotes,
      totalScoreSwing,
      topInfluencerUser: userImpactRanking.length > 0
        ? { userId: userImpactRanking[0].userId, displayName: userImpactRanking[0].displayName }
        : null,
      mostSupportedAnime: animeSupportRanking.length > 0
        ? { animeId: animeSupportRanking[0].animeId, title: animeSupportRanking[0].title }
        : null,
      mostSuppressedAnime: animeSuppressionRanking.length > 0
        ? { animeId: animeSuppressionRanking[0].animeId, title: animeSuppressionRanking[0].title }
        : null,
    },
    userImpactRanking,
    animeSupportRanking,
    animeSuppressionRanking,
    keyVotes,
    biasVoteStats,
    currentUserImpact,
  };
}

function createEmptyImpact(season: { id: string; title: string; mode: string; status: string }): BattleSeasonImpact {
  return {
    season: { id: season.id, title: season.title, mode: season.mode, status: season.status },
    stats: {
      totalVotes: 0,
      totalParticipants: 0,
      totalBiasVotes: 0,
      totalScoreSwing: 0,
      topInfluencerUser: null,
      mostSupportedAnime: null,
      mostSuppressedAnime: null,
    },
    userImpactRanking: [],
    animeSupportRanking: [],
    animeSuppressionRanking: [],
    keyVotes: [],
    biasVoteStats: null,
    currentUserImpact: null,
  };
}
