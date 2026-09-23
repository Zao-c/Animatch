import { withTransactionRetry } from "./transaction-retry";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getAnimeCoverUrl } from "./anime-cover-url";
import { getEffectiveAnimeDisplay } from "./anime-display";
import type { TasteEntry } from "./taste-analysis";
import { rankingEvidence } from "./ranking-evidence";
import type { SeasonPersonalRankingItem, SeasonRankingItem } from "./season-service";

export interface ArchivedScore { userId: string; animeId: string; score: number; count: number; bias: number; wins: number; losses: number; uncertainty: number }
export interface SeasonArchiveData {
  items: TasteEntry[];
  scores: ArchivedScore[];
}

export async function readSeasonArchiveData(db: Prisma.TransactionClient, poolId: string, seasonId: string): Promise<SeasonArchiveData> {
  const [entries, scores] = await Promise.all([
    db.poolAnime.findMany({ where: { poolId }, include: { anime: true }, orderBy: { position: "asc" } }),
    db.battleSeasonUserScore.findMany({ where: { seasonId, compareCount: { gt: 0 }, isHidden: false },
      select: { userId: true, animeId: true, eloScore: true, compareCount: true, biasWinCount: true, winCount: true, lossCount: true, uncertainty: true } })
  ]);
  const ids = new Set(entries.map((entry) => entry.animeId));
  return {
    items: entries.map((entry) => {
      const display = getEffectiveAnimeDisplay(entry);
      return { animeId: entry.animeId, title: display.title, imageUrl: display.coverUrl ?? getAnimeCoverUrl(entry.anime), tags: display.tags, score: 1500 };
    }),
    scores: scores.filter((score) => ids.has(score.animeId)).map((score) => ({
      userId: score.userId, animeId: score.animeId, score: score.eloScore, count: score.compareCount, bias: score.biasWinCount,
      wins: score.winCount, losses: score.lossCount, uncertainty: score.uncertainty
    }))
  };
}

// Used for scheduled endings and older seasons. The capture time is displayed, never backdated.
export async function getSeasonArchiveData(poolId: string, seasonId: string) {
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    const existing = await tx.battleSeasonArchive.findUnique({ where: { seasonId } });
    if (existing) return { data: existing.payload as unknown as SeasonArchiveData, capturedAt: existing.capturedAt.toISOString() };
    const season = await tx.battleSeason.findUniqueOrThrow({ where: { id: seasonId } });
    const data = await readSeasonArchiveData(tx, poolId, seasonId);
    if (season.status === "ENDED" || (season.status === "ACTIVE" && season.endsAt !== null && season.endsAt <= new Date())) {
      const saved = await tx.battleSeasonArchive.upsert({ where: { seasonId }, update: {},
        create: { seasonId, payload: data as unknown as Prisma.InputJsonValue } });
      return { data: saved.payload as unknown as SeasonArchiveData, capturedAt: saved.capturedAt.toISOString() };
    }
    return { data, capturedAt: null };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 }));
}

export function archivePersonal(data: SeasonArchiveData, userId: string): TasteEntry[] {
  const scores = new Map(data.scores.filter((row) => row.userId === userId).map((row) => [row.animeId, row.score]));
  return data.items.filter((item) => scores.has(item.animeId)).map((item) => ({ ...item, score: scores.get(item.animeId)! }));
}

export function archiveCommunity(data: SeasonArchiveData): TasteEntry[] {
  const aggregate = new Map<string, { sum: number; weight: number; users: Set<string>; count: number }>();
  for (const row of data.scores) {
    const value = aggregate.get(row.animeId) ?? { sum: 0, weight: 0, users: new Set<string>(), count: 0 };
    if (value.users.has(row.userId)) continue;
    const weight = Math.min(row.count / 5, 1) * (row.bias > 0 ? 1.5 : 1);
    value.sum += row.score * weight; value.weight += weight; value.users.add(row.userId); value.count += row.count;
    aggregate.set(row.animeId, value);
  }
  return data.items.filter((item) => {
    const value = aggregate.get(item.animeId);
    return value && value.users.size >= 3 && value.count >= 6;
  }).map((item) => {
    const value = aggregate.get(item.animeId)!;
    return { ...item, score: (4500 + value.sum) / (3 + value.weight) };
  });
}

export function archivedSeasonRanking(data: SeasonArchiveData): SeasonRankingItem[] {
  const participants = new Set(data.scores.map((score) => score.userId)).size;
  const rows = new Map<string, ArchivedScore[]>();
  for (const score of data.scores) { const list = rows.get(score.animeId) ?? []; list.push(score); rows.set(score.animeId, list); }
  return data.items.map((item) => {
    const scores = [...new Map((rows.get(item.animeId) ?? []).map((score) => [score.userId, score])).values()];
    let sum = 0, weight = 0;
    for (const score of scores) { const w = Math.min(score.count / 5, 1) * (score.bias > 0 ? 1.5 : 1); sum += score.score * w; weight += w; }
    const count = scores.reduce((n, row) => n + row.count, 0);
    return { animeId: item.animeId, title: item.title, imageUrl: item.imageUrl, score: (4500 + sum) / (3 + weight),
      winCount: scores.reduce((n, row) => n + row.wins, 0), lossCount: scores.reduce((n, row) => n + row.losses, 0),
      biasWinCount: scores.reduce((n, row) => n + row.bias, 0), participantCount: scores.length, comparisonCount: count,
      averageElo: scores.length ? scores.reduce((n, row) => n + row.score, 0) / scores.length : null,
      insufficientSample: scores.length < 3 || count < 6, ...rankingEvidence(scores.map((row) => row.score), participants) };
  }).sort((a, b) => Number(a.insufficientSample) - Number(b.insufficientSample) || b.score - a.score || b.participantCount - a.participantCount || b.comparisonCount - a.comparisonCount || a.title.localeCompare(b.title) || a.animeId.localeCompare(b.animeId));
}

export function archivedPersonalRanking(data: SeasonArchiveData, userId: string): SeasonPersonalRankingItem[] {
  const rows = new Map(data.scores.filter((row) => row.userId === userId).map((row) => [row.animeId, row]));
  return data.items.filter((item) => rows.has(item.animeId)).map((item) => {
    const row = rows.get(item.animeId)!;
    return { animeId: item.animeId, title: item.title, imageUrl: item.imageUrl, score: row.score, uncertainty: row.uncertainty,
      comparisonCount: row.count, winCount: row.wins, lossCount: row.losses, biasWinCount: row.bias };
  }).sort((a, b) => b.score - a.score || b.comparisonCount - a.comparisonCount || b.winCount - a.winCount || a.title.localeCompare(b.title) || a.animeId.localeCompare(b.animeId));
}
