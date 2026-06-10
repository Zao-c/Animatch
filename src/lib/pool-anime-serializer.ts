import type { Prisma } from "@prisma/client";
import { toPublicAnime } from "./anime-service";
import { getEffectiveAnimeDisplay } from "./anime-display";

export type PoolAnimeWithAnime = Prisma.PoolAnimeGetPayload<{
  include: { anime: true };
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
