import { withTransactionRetry } from "./transaction-retry";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./app-error";
import { canReadPool } from "./pool-permissions";
import { archiveCommunity, archivePersonal, getSeasonArchiveData, type SeasonArchiveData } from "./season-archive";
import { compareStages, type TasteEntry } from "./taste-analysis";

export interface CollectionInput {
  title: string; year: number;
  sources: Array<{ seasonId: string; quarter: number; phase: "OPENING" | "ENDING" }>;
}

export function validateCollectionInput(input: unknown): CollectionInput {
  if (!input || typeof input !== "object") throw new AppError("请填写组合信息", 400);
  const value = input as CollectionInput;
  if (typeof value.title !== "string" || value.title.trim().length < 1 || value.title.trim().length > 80 ||
      !Number.isInteger(value.year) || value.year < 2000 || value.year > 2100 ||
      !Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 8) {
    throw new AppError("组合需要名称、有效年份和 1–8 个阶段", 400);
  }
  const slots = new Set<string>(), ids = new Set<string>();
  for (const source of value.sources) {
    if (!source || typeof source.seasonId !== "string" || source.seasonId.length > 100 ||
      !Number.isInteger(source.quarter) || source.quarter < 1 || source.quarter > 4 ||
      !["OPENING", "ENDING"].includes(source.phase)) throw new AppError("季度或阶段无效", 400);
    const key = `${source.quarter}:${source.phase}`;
    if (slots.has(key) || ids.has(source.seasonId)) throw new AppError("同一季度阶段和赛季不能重复添加", 400);
    slots.add(key); ids.add(source.seasonId);
  }
  return { title: value.title.trim(), year: value.year, sources: value.sources };
}

export async function saveCollection(userId: string, input: unknown, id?: string) {
  const value = validateCollectionInput(input);
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.animeCollection.findFirst({ where: { id, ownerId: userId } });
      if (!existing) throw new AppError("组合不存在", 404);
      if (existing.finalPoolId) throw new AppError("已创建年度对决的组合不能更换来源，请另建组合", 409);
    }
    const seasons = await tx.battleSeason.findMany({ where: { id: { in: value.sources.map((source) => source.seasonId) } }, include: { pool: true } });
    if (seasons.length !== value.sources.length || seasons.some((season) => season.pool.deletedAt || !canReadPool(season.pool, { id: userId }))) {
      throw new AppError("部分来源已移除或无权访问", 403);
    }
    const sourceData = value.sources.map((source) => ({ ...source, poolId: seasons.find((season) => season.id === source.seasonId)!.poolId }));
    const data = { title: value.title, year: value.year, sources: { create: sourceData } };
    if (!id) return tx.animeCollection.create({ data: { ...data, ownerId: userId } });
    await tx.collectionSource.deleteMany({ where: { collectionId: id } });
    return tx.animeCollection.update({ where: { id }, data });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function getCollection(userId: string, id: string) {
  const collection = await prisma.animeCollection.findFirst({ where: { id, ownerId: userId },
    include: { sources: { include: { pool: true, season: true }, orderBy: [{ quarter: "asc" }, { phase: "desc" }] } } });
  if (!collection) throw new AppError("组合不存在", 404);
  const sources: Array<{ id: string; quarter: number; phase: string; unavailable: boolean; seasonId: string; poolId: string; title: string; poolName: string; capturedAt: string | null; community: TasteEntry[]; personal: TasteEntry[]; items: TasteEntry[]; participantCount: number }> = [];
  for (const source of collection.sources) {
    if (source.pool.deletedAt || !canReadPool(source.pool, { id: userId })) {
      sources.push({ id: source.id, quarter: source.quarter, phase: source.phase, unavailable: true as const,
        seasonId: source.seasonId, poolId: source.poolId, title: "来源暂不可访问", poolName: "", capturedAt: null,
        community: [], personal: [], items: [], participantCount: 0 });
      continue;
    }
    const archive = await getSeasonArchiveData(source.poolId, source.seasonId);
    sources.push({ id: source.id, quarter: source.quarter, phase: source.phase, unavailable: false as const,
      seasonId: source.seasonId, poolId: source.poolId, title: source.season.title, poolName: source.pool.name,
      capturedAt: archive.capturedAt, community: archiveCommunity(archive.data), personal: archivePersonal(archive.data, userId),
      items: archive.data.items, participantCount: new Set(archive.data.scores.map((row) => row.userId)).size });
  }
  const comparisons = [1, 2, 3, 4].map((quarter) => {
    const opening = sources.find((source) => source.quarter === quarter && source.phase === "OPENING" && !source.unavailable);
    const ending = sources.find((source) => source.quarter === quarter && source.phase === "ENDING" && !source.unavailable);
    return { quarter, ready: Boolean(opening && ending),
      personal: opening && ending ? compareStages(opening.personal, ending.personal) : [],
      community: opening && ending ? compareStages(opening.community, ending.community) : [] };
  });
  const annualSources = [1, 2, 3, 4].flatMap((quarter) => {
    const source = sources.find((s) => s.quarter === quarter && s.phase === "ENDING" && !s.unavailable) ??
      sources.find((s) => s.quarter === quarter && !s.unavailable);
    return source ? [source] : [];
  });
  return { id: collection.id, title: collection.title, year: collection.year, finalPoolId: collection.finalPoolId,
    sources, comparisons, animeCount: new Set(annualSources.flatMap((source) => source.items.map((item) => item.animeId))).size,
    evaluatedCount: new Set(annualSources.flatMap((source) => source.personal.map((item) => item.animeId))).size };
}

export async function createAnnualFinal(userId: string, id: string) {
  // Serializable + row lock makes double clicks/retries return the same final pool.
  return withTransactionRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "AnimeCollection" WHERE "id" = ${id} AND "ownerId" = ${userId} FOR UPDATE`;
    const collection = await tx.animeCollection.findFirst({ where: { id, ownerId: userId },
      include: { sources: { include: { pool: { include: { poolAnime: { include: { anime: { select: { deletedAt: true } } }, orderBy: { position: "asc" } } } }, season: { include: { archive: true } } } } } });
    if (!collection) throw new AppError("组合不存在", 404);
    if (collection.finalPoolId) return { poolId: collection.finalPoolId };
    if (collection.sources.some((s) => s.pool.deletedAt || !canReadPool(s.pool, { id: userId }))) throw new AppError("请先移除无法访问的来源", 403);
    const chosen = [1, 2, 3, 4].flatMap((quarter) => {
      const source = collection.sources.find((s) => s.quarter === quarter && s.phase === "ENDING") ?? collection.sources.find((s) => s.quarter === quarter);
      return source ? [source] : [];
    });
    const merged = [...new Map(chosen.flatMap((source) => {
      if (source.season.archive) {
        const saved = source.season.archive.payload as unknown as SeasonArchiveData;
        return saved.items.map((item) => ({ animeId: item.animeId, displayTitleOverride: item.title,
          coverUrlOverride: item.imageUrl, tagsOverride: item.tags, animeTypeOverride: null as string | null }));
      }
      return source.pool.poolAnime.filter((entry) => !entry.anime.deletedAt).map((entry) => ({ animeId: entry.animeId,
        displayTitleOverride: entry.displayTitleOverride, coverUrlOverride: entry.coverUrlOverride,
        tagsOverride: entry.tagsOverride, animeTypeOverride: entry.animeTypeOverride }));
    }).map((entry) => [entry.animeId, entry])).values()];
    const available = await tx.anime.findMany({ where: { id: { in: merged.map((entry) => entry.animeId) }, deletedAt: null }, select: { id: true } });
    const activeIds = new Set(available.map((entry) => entry.id));
    const candidates = merged.filter((entry) => activeIds.has(entry.animeId));
    if (candidates.length < 2) throw new AppError("年度对决至少需要两部作品", 400);
    if (candidates.length > 1000) throw new AppError("候选超过 1000 部，请缩小来源范围", 400);
    const pool = await tx.customPool.create({ data: {
      creatorId: userId, name: `${collection.title} · 年度总决选`, visibility: "PRIVATE", status: "PUBLISHED",
      description: "由年度组合去重生成。通过新的跨季度对决产生年度榜，季度 Elo 不会直接合并。",
      tags: ["年度总决选", String(collection.year)],
      poolAnime: { create: candidates.map((entry, position) => ({ animeId: entry.animeId, position,
        displayTitleOverride: entry.displayTitleOverride, coverUrlOverride: entry.coverUrlOverride,
        tagsOverride: entry.tagsOverride, animeTypeOverride: entry.animeTypeOverride })) }
    } });
    await tx.animeCollection.update({ where: { id }, data: { finalPoolId: pool.id } });
    return { poolId: pool.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }));
}
