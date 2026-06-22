import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { prewarmCoverCacheBackground } from "@/lib/server/cover-cache-prewarm";
import { GLOBAL_SEARCH_EXCLUDED_SOURCES } from "@/lib/anime-service";
import type { Anime } from "@prisma/client";
import type { NormalizedBangumiSubject } from "@/lib/bangumi";
import {
  fetchBangumiSubjects,
  shouldUseRemote,
  upsertBangumiSubjects,
  type RemoteFetchResult,
} from "./bangumi-import-source";
import {
  getBangumiSubjectCache,
  setBangumiSubjectCache,
} from "./bangumi-import-cache";

export type ImportSource = "BANGUMI" | "MANAMI" | "MIXED";
export type ImportMode = "YEAR" | "TAG" | "TOP" | "USER_COLLECTION";

export interface QuickImportParams {
  source: ImportSource;
  mode: ImportMode;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  type?: string;
  tags?: string[];
  limit?: number;
  sort?: string;
  bangumiUserId?: string;
  collectionType?: string;
}

export interface QuickImportCandidate {
  animeId: string;
  source: string;
  bgmId: number | null;
  title: string;
  titleCn: string | null;
  year: number | null;
  animeType: string | null;
  tags: string[];
  score: number | null;
  rank: number | null;
  imageUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  alreadyInPool?: boolean;
}

export interface QuickImportPreviewResult {
  candidates: QuickImportCandidate[];
  warnings: string[];
  total: number;
  remoteFetch?: RemoteFetchResult;
}

export interface QuickImportCreateResult {
  poolId: string;
  poolName: string;
  addedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface QuickImportAddResult {
  addedCount: number;
  skippedCount: number;
  failedCount: number;
  addedItems: { animeId: string; title: string }[];
}

const MAX_LIMIT = 100;

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || raw === null) return 50;
  return Math.max(1, Math.min(raw, MAX_LIMIT));
}

function resolveSources(source: ImportSource): string[] {
  if (source === "BANGUMI") return ["BANGUMI"];
  if (source === "MANAMI") return ["MANAMI"];
  return ["BANGUMI", "MANAMI"];
}

function candidateFromAnime(anime: Anime, poolAnimeIds?: Set<string>): QuickImportCandidate {
  return {
    animeId: anime.id,
    source: anime.source,
    bgmId: anime.bgmId,
    title: anime.title,
    titleCn: anime.titleCn,
    year: anime.year,
    animeType: anime.animeType,
    tags: anime.tags ?? [],
    score: anime.bangumiScore,
    rank: anime.bangumiRank,
    imageUrl: anime.imageUrl,
    imageMediumUrl: anime.imageMediumUrl,
    imageLargeUrl: anime.imageLargeUrl,
    thumbnailUrl: anime.thumbnailUrl,
    coverUrl: getAnimeCoverUrl(anime, { intent: "display" }),
    alreadyInPool: poolAnimeIds ? poolAnimeIds.has(anime.id) : undefined,
  };
}

export async function previewQuickImport(
  params: QuickImportParams,
  poolAnimeIds?: Set<string>
): Promise<QuickImportPreviewResult> {
  const warnings: string[] = [];
  const limit = clampLimit(params.limit);
  const sources = resolveSources(params.source);
  const sourceFilter = sources.includes("BANGUMI") && sources.includes("MANAMI")
    ? { notIn: GLOBAL_SEARCH_EXCLUDED_SOURCES }
    : { in: sources as Prisma.EnumAnimeSourceTypeFilter["in"] };

  if (params.source === "MANAMI") {
    if (!sources.includes("MANAMI")) {
      return { candidates: [], warnings: ["未选择有效数据源"], total: 0 };
    }
  }

  const where: Prisma.AnimeWhereInput = {
    source: sourceFilter,
    deletedAt: null,
  };
  const andConditions: Prisma.AnimeWhereInput[] = [];

  if (params.mode === "YEAR") {
    if (!params.year) {
      warnings.push("年份模式需要指定 year 参数");
    }
    if (params.year) {
      where.year = params.year;
    }
    if (params.type && params.type !== "ALL") {
      where.animeType = params.type.toUpperCase();
    }
  }

  if (params.mode === "TAG") {
    if (!params.tags || params.tags.length === 0) {
      warnings.push("标签模式需要指定至少一个标签");
    } else {
      andConditions.push(...params.tags.map((tag) => ({ tags: { has: tag } })));
    }
    if (params.yearFrom !== undefined || params.yearTo !== undefined) {
      where.year = {};
      if (params.yearFrom !== undefined) where.year.gte = params.yearFrom;
      if (params.yearTo !== undefined) where.year.lte = params.yearTo;
    }
    if (params.type && params.type !== "ALL") {
      where.animeType = params.type.toUpperCase();
    }
  }

  if (params.mode === "TOP") {
    if (params.type && params.type !== "ALL") {
      where.animeType = params.type.toUpperCase();
    }
    if (params.year) {
      where.year = params.year;
    }
  }

  if (params.mode === "USER_COLLECTION") {
    if (!params.bangumiUserId?.trim()) {
      warnings.push("用户收藏模式需要填写 Bangumi 用户 ID");
    } else {
      warnings.push("用户收藏模式需要开启 Bangumi 远程拉取");
    }
    return { candidates: [], warnings, total: 0 };
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  let orderBy: Prisma.AnimeOrderByWithRelationInput | Prisma.AnimeOrderByWithRelationInput[];
  if (params.mode === "TOP") {
    orderBy = [{ bangumiRank: "asc" }, { bangumiScore: "desc" }];
  } else if (params.sort === "year") {
    orderBy = { year: "desc" };
  } else if (params.sort === "score") {
    orderBy = { bangumiScore: "desc" };
  } else if (params.sort === "rank") {
    orderBy = { bangumiRank: "asc" };
  } else {
    orderBy = { title: "asc" };
  }

  const items = await prisma.anime.findMany({
    where,
    orderBy,
    take: limit,
  });

  const deduped = new Map<string, Anime>();
  for (const item of items) {
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  }

  const candidates = Array.from(deduped.values()).map((a) => candidateFromAnime(a, poolAnimeIds));

  warnings.push(...candidateWarnings(candidates));

  return {
    candidates,
    warnings,
    total: candidates.length,
  };
}

function candidateWarnings(candidates: QuickImportCandidate[]): string[] {
  const warnings: string[] = [];
  const missingCovers = candidates.filter((c) => !c.coverUrl).length;
  if (missingCovers > 0) {
    warnings.push(`${missingCovers} 部作品缺少封面`);
  }
  return warnings;
}

export async function createPoolFromQuickImport(
  params: QuickImportParams & { poolName: string; description?: string; visibility?: string },
  userId: string
): Promise<QuickImportCreateResult> {
  const normalizedName = params.poolName.trim();
  if (!normalizedName || normalizedName.length > 80) {
    throw new Error("番组名不能为空且不超过80个字符");
  }

  const { candidates, warnings } = await previewQuickImportWithRemoteFallback(params);

  if (candidates.length === 0) {
    throw new Error("没有找到符合条件的作品");
  }

  const visibility = params.visibility === "PUBLIC" || params.visibility === "UNLISTED"
    ? params.visibility
    : "PRIVATE";

  const pool = await prisma.customPool.create({
    data: {
      name: normalizedName,
      description: params.description?.trim() || null,
      visibility: visibility as "PUBLIC" | "PRIVATE" | "UNLISTED",
      creatorId: userId,
    },
  });

  const result = await addAnimeToPoolBatch(pool.id, candidates.map((c) => c.animeId));

  return {
    poolId: pool.id,
    poolName: normalizedName,
    ...result,
  };
}

export async function addQuickImportToPool(
  poolId: string,
  animeIds: string[],
  userId: string
): Promise<QuickImportAddResult> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId } });
  if (!pool || pool.deletedAt) {
    throw new Error("番组不存在或已归档");
  }

  const result = await addAnimeToPoolBatch(poolId, animeIds);

  return {
    ...result,
    addedItems: await getAddedTitles(poolId, animeIds.slice(0, result.addedCount)),
  };
}

async function addAnimeToPoolBatch(
  poolId: string,
  animeIds: string[]
): Promise<{ addedCount: number; skippedCount: number; failedCount: number }> {
  let addedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const existingEntries = await prisma.poolAnime.findMany({
    where: { poolId, animeId: { in: animeIds } },
    select: { animeId: true },
  });
  const existingIds = new Set(existingEntries.map((e) => e.animeId));

  const maxPosition = await prisma.poolAnime.aggregate({
    where: { poolId },
    _max: { position: true },
  });
  let nextPosition = (maxPosition._max.position ?? 0) + 1;

  const coversToPrewarm: string[] = [];

  for (const animeId of animeIds) {
    if (existingIds.has(animeId)) {
      skippedCount++;
      continue;
    }

    try {
      const anime = await prisma.anime.findUnique({ where: { id: animeId } });
      if (!anime) {
        failedCount++;
        continue;
      }

      await prisma.poolAnime.create({
        data: {
          poolId,
          animeId,
          position: nextPosition++,
        },
      });

      const primary = getAnimeCoverUrl(anime, { intent: "display" });
      const secondary = getAnimeCoverUrl(anime, { intent: "export" });
      if (primary) coversToPrewarm.push(primary);
      if (secondary) coversToPrewarm.push(secondary);

      addedCount++;
    } catch {
      failedCount++;
    }
  }

  if (coversToPrewarm.length > 0) {
    prewarmCoverCacheBackground(coversToPrewarm, { limit: 60, concurrency: 5 });
  }

  return { addedCount, skippedCount, failedCount };
}

async function getAddedTitles(
  poolId: string,
  animeIds: string[]
): Promise<{ animeId: string; title: string }[]> {
  const existingEntries = await prisma.poolAnime.findMany({
    where: { poolId, animeId: { in: animeIds } },
    include: { anime: { select: { title: true, titleCn: true, titleJa: true } } },
  });
  return existingEntries.map((e) => ({
    animeId: e.animeId,
    title: e.anime.titleCn ?? e.anime.titleJa ?? e.anime.title,
  }));
}

async function previewBangumiSubjects(
  params: QuickImportParams,
  subjects: NormalizedBangumiSubject[],
  poolAnimeIds?: Set<string>
): Promise<QuickImportPreviewResult> {
  const limit = clampLimit(params.limit);
  const bgmIds = Array.from(new Set(subjects.map((subject) => subject.bgmId)));
  if (bgmIds.length === 0) {
    return { candidates: [], warnings: [], total: 0 };
  }

  const items = await prisma.anime.findMany({
    where: {
      bgmId: { in: bgmIds },
      deletedAt: null,
      source: { notIn: GLOBAL_SEARCH_EXCLUDED_SOURCES }
    }
  });

  const animeByBgmId = new Map<number, Anime>();
  for (const item of items) {
    if (item.bgmId !== null && !animeByBgmId.has(item.bgmId)) {
      animeByBgmId.set(item.bgmId, item);
    }
  }

  const ordered: Anime[] = [];
  const seenAnimeIds = new Set<string>();
  for (const subject of subjects) {
    const anime = animeByBgmId.get(subject.bgmId);
    if (!anime || seenAnimeIds.has(anime.id)) continue;
    ordered.push(anime);
    seenAnimeIds.add(anime.id);
    if (ordered.length >= limit) break;
  }

  const candidates = ordered.map((anime) => candidateFromAnime(anime, poolAnimeIds));

  return {
    candidates,
    warnings: candidateWarnings(candidates),
    total: candidates.length
  };
}

export async function previewQuickImportWithRemoteFallback(
  params: QuickImportParams,
  poolAnimeIds?: Set<string>,
  useRemote = true
): Promise<QuickImportPreviewResult> {
  const warnings: string[] = [];

  const localResult = await previewQuickImport(params, poolAnimeIds);
  const limit = clampLimit(params.limit);

  const shouldPreferRemote =
    params.source === "BANGUMI" || params.mode === "USER_COLLECTION";
  const shouldFetchRemote =
    useRemote &&
    shouldUseRemote(params) &&
    (shouldPreferRemote || localResult.candidates.length < limit);

  if (!shouldFetchRemote) {
    return {
      ...localResult,
      remoteFetch: {
        attempted: false,
        succeeded: false,
        insertedCount: 0,
        updatedCount: 0,
        fetchedCount: 0,
        source: null,
      },
    };
  }

  let remoteFetchResult: RemoteFetchResult = {
    attempted: true,
    succeeded: false,
    insertedCount: 0,
    updatedCount: 0,
    fetchedCount: 0,
    source: "BANGUMI",
  };

  try {
    let subjects = getBangumiSubjectCache(params);

    if (!subjects) {
      subjects = await fetchBangumiSubjects(params);
      if (subjects.length > 0) {
        setBangumiSubjectCache(params, subjects);
      }
    }

    if (subjects.length > 0) {
      remoteFetchResult.fetchedCount = subjects.length;
      remoteFetchResult.succeeded = true;

      try {
        const upsertResult = await upsertBangumiSubjects(subjects);
        remoteFetchResult.insertedCount = upsertResult.inserted;
        remoteFetchResult.updatedCount = upsertResult.updated;
      } catch {
        warnings.push("Bangumi 数据写入本地库失败");
      }

      const refreshedResult = await previewBangumiSubjects(params, subjects, poolAnimeIds);
      return {
        ...refreshedResult,
        warnings: [...warnings, ...refreshedResult.warnings],
        remoteFetch: remoteFetchResult,
      };
    }

    warnings.push("Bangumi 远程查询没有返回结果");
  } catch {
    warnings.push("Bangumi 暂时不可用，已返回本地结果");
    remoteFetchResult.succeeded = false;
  }

  return {
    ...localResult,
    warnings: [...warnings, ...localResult.warnings],
    remoteFetch: remoteFetchResult,
  };
}

export { QUICK_IMPORT_PRESETS } from "./quick-import-presets";
