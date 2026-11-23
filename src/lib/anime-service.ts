import { Prisma, type Anime } from "@prisma/client";
import { prisma } from "./db";
import { ANIME_SOURCE } from "./anime-source";
import { expandTagQuery } from "./anime-tag-dictionary";
import {
  buildBangumiSubjectUrl,
  getBangumiSubject,
  parseBangumiSubjectIds,
  searchBangumiAnime,
  type JsonValue,
  type NormalizedBangumiSubject
} from "./bangumi";
import { cacheAnimeCoverToCosBackground } from "./server/cos-cover-cache";

export interface PublicAnime {
  id: string;
  bgmId: number | null;
  title: string;
  titleCn: string | null;
  titleJa: string | null;
  titleEn: string | null;
  imageUrl: string | null;
  imageSmallUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  cachedCoverUrl?: string | null;
  cachedCoverSourceUrl?: string | null;
  coverUrl: string | null;
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

export type PublicAnimeSourceFields = Pick<
  Anime,
  | "id"
  | "bgmId"
  | "title"
  | "titleCn"
  | "titleJa"
  | "titleEn"
  | "imageUrl"
  | "imageSmallUrl"
  | "imageMediumUrl"
  | "imageLargeUrl"
  | "cachedCoverUrl"
  | "cachedCoverSourceUrl"
  | "thumbnailUrl"
  | "airDate"
  | "bangumiRank"
  | "bangumiScore"
  | "tags"
  | "aliases"
  | "year"
  | "season"
  | "animeType"
  | "studios"
  | "source"
>;

export interface ImportBangumiSubjectsResult {
  imported: Anime[];
  failed: { bgmId: number; reason: string }[];
}

export async function upsertAnimeFromBangumiSubject(
  subject: NormalizedBangumiSubject
): Promise<Anime> {
  const rawJson = toPrismaJson(subject.rawJson);
  const sourceId = String(subject.bgmId);
  const sourceUrl = buildBangumiSubjectUrl(subject.bgmId);

  const anime = await prisma.anime.upsert({
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
      externalLinks: [sourceUrl],
      source: ANIME_SOURCE.BANGUMI,
      sourceId,
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
      externalLinks: [sourceUrl],
      source: ANIME_SOURCE.BANGUMI,
      sourceId,
      rawJson,
      fetchedAt: new Date(),
      imageStatus: subject.imageUrl === null ? "MISSING" : "OK"
    }
  });
  cacheAnimeCoverToCosBackground(anime);
  return anime;
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
    cacheAnimeCoverToCosBackground(existingAnime);
    return existingAnime;
  }

  try {
    return await upsertAnimeFromBangumiSubject(await getBangumiSubject(bgmId));
  } catch {
    return null;
  }
}

export function toPublicAnime(anime: PublicAnimeSourceFields): PublicAnime {
  return {
    id: anime.id,
    bgmId: anime.bgmId,
    title: anime.title,
    titleCn: anime.titleCn,
    titleJa: anime.titleJa,
    titleEn: anime.titleEn,
    imageUrl: anime.imageUrl,
    imageSmallUrl: anime.imageSmallUrl,
    imageMediumUrl: anime.imageMediumUrl,
    imageLargeUrl: anime.imageLargeUrl,
    cachedCoverUrl: anime.cachedCoverUrl,
    coverUrl: anime.cachedCoverUrl ?? anime.thumbnailUrl ?? anime.imageUrl,
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

export const GLOBAL_SEARCH_EXCLUDED_SOURCES = [
  ANIME_SOURCE.CUSTOM_UPLOAD,
  ANIME_SOURCE.MANUAL,
  ANIME_SOURCE.TIERMAKER_IMPORT,
];

export type AnimeSearchScoringFields = Pick<
  Anime,
  | "title"
  | "titleCn"
  | "titleJa"
  | "titleEn"
  | "aliases"
  | "animeType"
  | "episodes"
  | "bangumiScore"
  | "year"
  | "rawJson"
>;

const SEARCH_ALIAS_OVERRIDES: Record<string, string[]> = {
  "进击的巨人": ["Attack on Titan", "Shingeki no Kyojin", "進撃の巨人"],
  "進擊的巨人": ["Attack on Titan", "Shingeki no Kyojin", "進撃の巨人"],
  "间谍过家家": ["Spy x Family", "Spy Family", "SPY×FAMILY"],
  "間諜過家家": ["Spy x Family", "Spy Family", "SPY×FAMILY"],
  "海贼王": ["One Piece", "ONE PIECE", "航海王"],
  "海賊王": ["One Piece", "ONE PIECE", "航海王"],
};

const TYPE_SCORE: Record<string, number> = {
  TV: 120,
  MOVIE: 100,
  OVA: 60,
  ONA: -30,
  SPECIAL: -50,
  MUSIC: -120,
  CM: -150,
  PV: -150,
  UNKNOWN: -20,
};

const SHORT_FORM_KEYWORDS = [
  "campaign",
  "cm",
  "pv",
  "commercial",
  "music video",
  "trailer",
  "teaser",
  "recap",
  "digest",
  "summary",
  "special interview",
  "collaboration",
  "ayataka",
  "追いつける",
  "10分",
  "15分",
  "20分",
  "25分",
  "おさらい",
  "振り返り",
  "総集編",
  "宣伝",
  "キャンペーン",
  "コラボ",
];

export function normalizeTitleForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s"'“”‘’「」『』【】（）()[\]{}:：!！?？.,，。・/\\_\-]+/g, "");
}

export function scoreAnimeSearchResult(
  anime: AnimeSearchScoringFields,
  query: string
): number {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return 0;

  const queryVariants = expandSearchTerm(trimmedQuery);
  const normalizedQueries = queryVariants.map(normalizeTitleForSearch).filter(Boolean);
  const titleFields = [
    anime.title,
    anime.titleCn,
    anime.titleJa,
    anime.titleEn,
  ].filter((value): value is string => Boolean(value));
  const aliases = anime.aliases ?? [];
  const searchableValues = [...titleFields, ...aliases];
  const normalizedValues = searchableValues.map(normalizeTitleForSearch);

  let score = 0;

  if (anime.titleCn !== null && hasExactMatch([anime.titleCn], queryVariants)) {
    score += 1000;
  }

  if (hasExactChineseAlias(aliases, queryVariants)) {
    score += 1000;
  }

  if (hasExactMatch([anime.title, anime.titleEn, anime.titleJa], queryVariants)) {
    score += 800;
  }

  if (
    normalizedQueries.some((normalizedQuery) =>
      normalizedValues.some((value) => value.includes(normalizedQuery))
    )
  ) {
    score += 500;
  }

  if (hasExactMatch(aliases, queryVariants)) {
    score += 300;
  }

  if (containsAnyQuery(anime.title, queryVariants)) {
    score += 250;
  }

  const normalizedType = normalizeAnimeType(anime.animeType);
  score += TYPE_SCORE[normalizedType] ?? 0;

  if ((anime.episodes ?? 0) >= 12) {
    score += 120;
  } else if ((anime.episodes ?? 0) >= 6) {
    score += 80;
  }

  if (
    anime.episodes === 1 &&
    (normalizedType === "ONA" || normalizedType === "SPECIAL")
  ) {
    score -= 100;
  }

  if (
    titleFields.some((title) => title.length <= trimmedQuery.length + 4) &&
    normalizedQueries.some((normalizedQuery) =>
      normalizedValues.some((value) => value === normalizedQuery)
    )
  ) {
    score += 120;
  }

  score += qualityScore(anime) * 8;
  score += shortFormPenalty(searchableValues);

  return score;
}

export function rankAnimeSearchResults<T extends AnimeSearchScoringFields>(
  items: T[],
  query: string
): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreAnimeSearchResult(item, query),
      typeRank: primaryTypeRank(item.animeType),
      quality: qualityScore(item),
      year: item.year ?? 0,
    }))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (Math.abs(scoreDelta) >= 50) return scoreDelta;

      const typeDelta = right.typeRank - left.typeRank;
      if (typeDelta !== 0) return typeDelta;

      const qualityDelta = right.quality - left.quality;
      if (qualityDelta !== 0) return qualityDelta;

      const yearDelta = right.year - left.year;
      if (yearDelta !== 0) return yearDelta;

      return left.index - right.index;
    })
    .map((ranked) => ranked.item);
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

  const conditions: Prisma.AnimeWhereInput[] = terms.map((term) => {
    const variants = expandSearchTerm(term);

    return {
      OR: variants.flatMap((variant) => [
        { title: { contains: variant, mode: "insensitive" } },
        { titleCn: { contains: variant, mode: "insensitive" } },
        { titleJa: { contains: variant, mode: "insensitive" } },
        { titleEn: { contains: variant, mode: "insensitive" } },
        { sourceId: { contains: variant, mode: "insensitive" } },
        { animeType: { contains: variant, mode: "insensitive" } },
        { season: { contains: variant, mode: "insensitive" } },
        { aliases: { has: variant } },
        { tags: { has: variant } },
        { studios: { has: variant } },
        { externalLinks: { has: variant } },
      ]),
    };
  });

  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const normalizedLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  const candidateTake = Math.min(500, Math.max(50, offset + normalizedLimit * 8));

  const candidates = await prisma.anime.findMany({
    where: {
      AND: conditions,
      source: {
        notIn: GLOBAL_SEARCH_EXCLUDED_SOURCES
      }
    },
    orderBy: { bgmId: { sort: "asc", nulls: "last" } },
    take: candidateTake,
  });

  return rankAnimeSearchResults(candidates, trimmed).slice(offset, offset + normalizedLimit);
}

function expandSearchTerm(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const aliases = SEARCH_ALIAS_OVERRIDES[trimmed] ?? [];
  return Array.from(new Set([trimmed, ...aliases, ...expandTagQuery(trimmed)]));
}

function normalizeAnimeType(type: string | null): string {
  return (type ?? "UNKNOWN").trim().toUpperCase();
}

function hasExactMatch(values: Array<string | null>, queries: string[]): boolean {
  return values.some((value) => {
    if (value === null) return false;
    const normalizedValue = normalizeTitleForSearch(value);
    return queries.some((query) => normalizedValue === normalizeTitleForSearch(query));
  });
}

function hasExactChineseAlias(aliases: string[], queries: string[]): boolean {
  return aliases.some(
    (alias) => CHINESE_CHAR_RANGE.test(alias) && hasExactMatch([alias], queries)
  );
}

function containsAnyQuery(value: string, queries: string[]): boolean {
  const normalizedValue = normalizeTitleForSearch(value);
  return queries.some((query) => normalizedValue.includes(normalizeTitleForSearch(query)));
}

function shortFormPenalty(values: string[]): number {
  const normalizedValues = values.map((value) => normalizeTitleForSearch(value));
  let penalty = 0;

  for (const keyword of SHORT_FORM_KEYWORDS) {
    const normalizedKeyword = normalizeTitleForSearch(keyword);
    if (normalizedValues.some((value) => value.includes(normalizedKeyword))) {
      penalty -= isStrongShortFormKeyword(keyword) ? 800 : 300;
    }
  }

  return Math.max(-1200, penalty);
}

function isStrongShortFormKeyword(keyword: string): boolean {
  return [
    "campaign",
    "commercial",
    "music video",
    "recap",
    "digest",
    "summary",
    "ayataka",
    "追いつける",
    "10分",
    "15分",
    "20分",
    "25分",
    "総集編",
    "キャンペーン",
  ].includes(keyword);
}

function qualityScore(anime: AnimeSearchScoringFields): number {
  if (anime.bangumiScore !== null) {
    return anime.bangumiScore;
  }

  const rawJson = anime.rawJson;
  if (rawJson === null || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    return 0;
  }

  const score = rawJson.score;
  if (score === null || typeof score !== "object" || Array.isArray(score)) {
    return 0;
  }

  const arithmeticGeometricMean = score.arithmeticGeometricMean;
  return typeof arithmeticGeometricMean === "number" ? arithmeticGeometricMean : 0;
}

function primaryTypeRank(type: string | null): number {
  switch (normalizeAnimeType(type)) {
    case "TV":
      return 4;
    case "MOVIE":
      return 3;
    case "OVA":
      return 2;
    default:
      return 1;
  }
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
      source: ANIME_SOURCE.MANUAL,
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
        where: { source: ANIME_SOURCE.MANAMI, sourceId },
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
          source: ANIME_SOURCE.MANAMI,
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
