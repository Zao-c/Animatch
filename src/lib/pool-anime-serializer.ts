import type { Prisma } from "@prisma/client";
import { toPublicAnime } from "./anime-service";
import { getEffectiveAnimeDisplay } from "./anime-display";

export const poolAnimePublicAnimeSelect = {
  id: true,
  bgmId: true,
  title: true,
  titleCn: true,
  titleJa: true,
  titleEn: true,
  imageUrl: true,
  imageSmallUrl: true,
  imageMediumUrl: true,
  imageLargeUrl: true,
  cachedCoverUrl: true,
  cachedCoverSourceUrl: true,
  thumbnailUrl: true,
  airDate: true,
  bangumiRank: true,
  bangumiScore: true,
  tags: true,
  aliases: true,
  year: true,
  season: true,
  animeType: true,
  studios: true,
  source: true
} satisfies Prisma.AnimeSelect;

export type PoolAnimeWithAnime = Prisma.PoolAnimeGetPayload<{
  include: { anime: { select: typeof poolAnimePublicAnimeSelect } };
}>;

export function serializePoolAnime(entry: PoolAnimeWithAnime) {
  return {
    id: entry.id,
    poolId: entry.poolId,
    animeId: entry.animeId,
    position: entry.position,
    note: entry.note,
    initialElo: entry.initialElo,
    displayTitleOverride: entry.displayTitleOverride,
    coverUrlOverride: entry.coverUrlOverride,
    animeTypeOverride: entry.animeTypeOverride,
    tagsOverride: entry.tagsOverride,
    overrideNote: entry.overrideNote,
    overrideUpdatedAt: entry.overrideUpdatedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    anime: toPublicAnime(entry.anime),
    display: getEffectiveAnimeDisplay(entry)
  };
}
