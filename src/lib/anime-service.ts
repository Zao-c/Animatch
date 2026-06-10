import { Prisma, type Anime } from "@prisma/client";
import { prisma } from "./db";
import {
  getBangumiSubject,
  parseBangumiSubjectIds,
  searchBangumiAnime,
  type JsonValue,
  type NormalizedBangumiSubject
} from "./bangumi";

export interface PublicAnime {
  id: string;
  bgmId: number | null;
  title: string;
  titleCn: string | null;
  titleJa: string | null;
  imageUrl: string | null;
  imageSmallUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  thumbnailUrl: string | null;
  airDate: Date | null;
  bangumiRank: number | null;
  bangumiScore: number | null;
  tags: string[];
  aliases: string[];
  year: number | null;
  season: string | null;
  animeType: string | null;
  studios: string[];
  source: string;
}

export interface ImportBangumiSubjectsResult {
  imported: Anime[];
  failed: { bgmId: number; reason: string }[];
}

export async function upsertAnimeFromBangumiSubject(
  subject: NormalizedBangumiSubject
): Promise<Anime> {
  const rawJson = toPrismaJson(subject.rawJson);

  return prisma.anime.upsert({
    where: {
      bgmId: subject.bgmId
    },
    create: {
      bgmId: subject.bgmId,
      title: subject.title,
      titleCn: subject.titleCn,
      summary: subject.summary,
      imageUrl: subject.imageUrl,
      imageSmallUrl: subject.imageSmallUrl,
      imageMediumUrl: subject.imageMediumUrl,
      imageLargeUrl: subject.imageLargeUrl,
      airDate: subject.airDate,
      bangumiRank: subject.bangumiRank,
      bangumiScore: subject.bangumiScore,
      bangumiVotes: subject.bangumiVotes,
      tags: subject.tags,
      rawJson,
      fetchedAt: new Date(),
      imageStatus: subject.imageUrl === null ? "MISSING" : "OK"
    },
    update: {
      title: subject.title,
      titleCn: subject.titleCn,
      summary: subject.summary,
      imageUrl: subject.imageUrl,
      imageSmallUrl: subject.imageSmallUrl,
      imageMediumUrl: subject.imageMediumUrl,
      imageLargeUrl: subject.imageLargeUrl,
      airDate: subject.airDate,
      bangumiRank: subject.bangumiRank,
      bangumiScore: subject.bangumiScore,
      bangumiVotes: subject.bangumiVotes,
      tags: subject.tags,
      rawJson,
      fetchedAt: new Date(),
      imageStatus: subject.imageUrl === null ? "MISSING" : "OK"
    }
  });
}

function toPrismaJson(value: JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export async function searchAndCacheAnime(
  keyword: string,
  limit = 20
): Promise<Anime[]> {
  const trimmedKeyword = keyword.trim();

  if (!trimmedKeyword) {
    throw new Error("keyword is required");
  }

  const subjects = await searchBangumiAnime(trimmedKeyword, { limit });
  const anime: Anime[] = [];

  for (const subject of subjects) {
    anime.push(await upsertAnimeFromBangumiSubject(subject));
  }

  return anime;
}

export async function importBangumiSubjects(
  input: string
): Promise<ImportBangumiSubjectsResult> {
  const ids = parseBangumiSubjectIds(input);

  if (ids.length > 50) {
    throw new Error("Cannot import more than 50 Bangumi subjects at once");
  }

  const imported: Anime[] = [];
  const failed: { bgmId: number; reason: string }[] = [];

  for (const bgmId of ids) {
    try {
      const subject = await getBangumiSubject(bgmId);
      imported.push(await upsertAnimeFromBangumiSubject(subject));
    } catch (error) {
      failed.push({
        bgmId,
        reason: error instanceof Error ? error.message : "Unknown import error"
      });
    }
  }

  return {
    imported,
    failed
  };
}

export async function getOrImportAnimeByBgmId(bgmId: number): Promise<Anime | null> {
  const existingAnime = await prisma.anime.findUnique({
    where: {
      bgmId
    }
  });

  if (existingAnime !== null) {
    return existingAnime;
  }

  try {
    return await upsertAnimeFromBangumiSubject(await getBangumiSubject(bgmId));
  } catch {
    return null;
  }
}

export function toPublicAnime(anime: Anime): PublicAnime {
  return {
    id: anime.id,
    bgmId: anime.bgmId,
    title: anime.title,
    titleCn: anime.titleCn,
    titleJa: anime.titleJa,
    imageUrl: anime.imageUrl,
    imageSmallUrl: anime.imageSmallUrl,
    imageMediumUrl: anime.imageMediumUrl,
    imageLargeUrl: anime.imageLargeUrl,
    thumbnailUrl: anime.thumbnailUrl,
    airDate: anime.airDate,
    bangumiRank: anime.bangumiRank,
    bangumiScore: anime.bangumiScore,
    tags: anime.tags,
    aliases: anime.aliases,
    year: anime.year,
    season: anime.season,
    animeType: anime.animeType,
    studios: anime.studios,
    source: anime.source,
  };
}

export async function searchLocalAnime(
  query: string,
  limit = 20,
  options: { offset?: number } = {}
): Promise<Anime[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms = trimmed.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const conditions: Prisma.AnimeWhereInput[] = terms.map((term) => ({
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { titleCn: { contains: term, mode: "insensitive" } },
      { titleJa: { contains: term, mode: "insensitive" } },
      { titleEn: { contains: term, mode: "insensitive" } },
      { sourceId: { contains: term, mode: "insensitive" } },
      { animeType: { contains: term, mode: "insensitive" } },
      { season: { contains: term, mode: "insensitive" } },
      { aliases: { has: term } },
      { tags: { has: term } },
      { studios: { has: term } },
      { externalLinks: { has: term } },
    ],
  }));

  const offset = Math.max(0, Math.trunc(options.offset ?? 0));

  return prisma.anime.findMany({
    where: {
      AND: conditions,
    },
    orderBy: { bgmId: { sort: "asc", nulls: "last" } },
    take: Math.min(50, Math.max(1, Math.trunc(limit))),
    skip: offset,
  });
}

export interface ManualAnimeInput {
  title: string;
  titleCn?: string;
  titleJa?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  year?: number;
  season?: string;
  animeType?: string;
  tags?: string[];
  studios?: string[];
  summary?: string;
}

export async function createManualAnime(input: ManualAnimeInput): Promise<Anime> {
  if (!input.title?.trim()) {
    throw new Error("title is required");
  }

  const sourceId = `manual-${Date.now()}-${input.title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40)}`;

  return prisma.anime.create({
    data: {
      title: input.title.trim(),
      titleCn: input.titleCn?.trim() || null,
      titleJa: input.titleJa?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      year: input.year ?? null,
      season: input.season?.trim() || null,
      animeType: input.animeType?.trim() || null,
      tags: input.tags ?? [],
      studios: input.studios ?? [],
      summary: input.summary?.trim() || null,
      aliases: [],
      externalLinks: [],
      source: "MANUAL",
      sourceId,
      imageStatus: input.imageUrl ? "OK" : "MISSING",
    },
  });
}

// Manami data interfaces
export interface ManamiAnimeInput {
  sources: string[];
  title: string;
  type: string;
  episodes: number;
  status: string;
  animeSeason: { season: string; year: number } | null;
  picture: string;
  thumbnail: string;
  score: { arithmeticGeometricMean: number } | null;
  synonyms: string[];
  studios: string[];
  tags: string[];
}

export interface ImportManamiResult {
  imported: number;
  skipped: number;
  failed: number;
}

export async function importManamiSubjects(
  items: ManamiAnimeInput[],
  limit = 0
): Promise<ImportManamiResult> {
  const batch = limit > 0 ? items.slice(0, limit) : items;
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of batch) {
    try {
      const sourceId = extractManamiSourceId(item);
      if (!sourceId) {
        failed++;
        continue;
      }

      const existing = await prisma.anime.findFirst({
        where: { source: "MANAMI", sourceId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const titleCn = extractChineseSynonym(item.synonyms);
      const titleJa = extractJapaneseSynonym(item.synonyms);

      await prisma.anime.create({
        data: {
          title: item.title,
          titleCn,
          titleJa,
          titleEn: null,
          imageUrl: item.picture || null,
          thumbnailUrl: item.thumbnail || null,
          imageSmallUrl: item.thumbnail || null,
          imageMediumUrl: item.picture || null,
          year: item.animeSeason?.year ?? null,
          season: item.animeSeason?.season ?? null,
          animeType: item.type || null,
          episodes: item.episodes,
          status: item.status || null,
          tags: item.tags || [],
          aliases: item.synonyms || [],
          studios: item.studios || [],
          externalLinks: item.sources || [],
          source: "MANAMI",
          sourceId,
          rawJson: item as unknown as Prisma.InputJsonValue,
          imageStatus: item.picture ? "OK" : "MISSING",
        },
      });

      imported++;
    } catch {
      failed++;
    }
  }

  return { imported, skipped, failed };
}

function extractManamiSourceId(item: ManamiAnimeInput): string | null {
  for (const url of item.sources) {
    const malMatch = url.match(/myanimelist\.net\/anime\/(\d+)/);
    if (malMatch) return `mal/${malMatch[1]}`;
    const anilistMatch = url.match(/anilist\.co\/anime\/(\d+)/);
    if (anilistMatch) return `anilist/${anilistMatch[1]}`;
    const kitsuMatch = url.match(/kitsu\.io\/anime\/([\w-]+)/);
    if (kitsuMatch) return `kitsu/${kitsuMatch[1]}`;
  }
  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug ? `slug/${slug}` : null;
}

const CHINESE_CHAR_RANGE = /[\u4e00-\u9fff]/;
const JAPANESE_CHAR_RANGE = /[\u3040-\u309f\u30a0-\u30ff]/;

function extractChineseSynonym(synonyms: string[]): string | null {
  for (const s of synonyms) {
    if (CHINESE_CHAR_RANGE.test(s) && s.length <= 30) return s;
  }
  return null;
}

function extractJapaneseSynonym(synonyms: string[]): string | null {
  for (const s of synonyms) {
    if (JAPANESE_CHAR_RANGE.test(s) && s.length <= 30) return s;
  }
  return null;
}
