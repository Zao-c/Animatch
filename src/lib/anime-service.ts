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
  bgmId: number;
  title: string;
  titleCn: string | null;
  imageUrl: string | null;
  imageSmallUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  airDate: Date | null;
  bangumiRank: number | null;
  bangumiScore: number | null;
  tags: string[];
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
    imageUrl: anime.imageUrl,
    imageSmallUrl: anime.imageSmallUrl,
    imageMediumUrl: anime.imageMediumUrl,
    imageLargeUrl: anime.imageLargeUrl,
    airDate: anime.airDate,
    bangumiRank: anime.bangumiRank,
    bangumiScore: anime.bangumiScore,
    tags: anime.tags
  };
}
