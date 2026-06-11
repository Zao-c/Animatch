export interface EffectiveAnimeDisplay {
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  animeType: string | null;
  tags: string[];
  sourceLabel: string;
  isOverridden: boolean;
  isCoverOverridden: boolean;
}

interface AnimeDisplayFields {
  title: string;
  titleCn: string | null;
  titleJa?: string | null;
  titleEn?: string | null;
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  animeType: string | null;
  tags: string[];
  source: string;
}

export interface PoolAnimeDisplayFields {
  displayTitleOverride: string | null;
  coverUrlOverride: string | null;
  animeTypeOverride: string | null;
  tagsOverride: string[];
  overrideNote?: string | null;
  anime: AnimeDisplayFields;
}

export function getEffectiveAnimeDisplay(
  entry: PoolAnimeDisplayFields
): EffectiveAnimeDisplay {
  const title =
    nonEmpty(entry.displayTitleOverride) ??
    nonEmpty(entry.anime.titleCn) ??
    nonEmpty(entry.anime.title) ??
    nonEmpty(entry.anime.titleJa) ??
    nonEmpty(entry.anime.titleEn) ??
    "Untitled anime";
  const subtitle = firstDistinctTitle(title, [
    entry.anime.title,
    entry.anime.titleJa ?? null,
    entry.anime.titleEn ?? null,
    entry.anime.titleCn
  ]);
  const tags = entry.tagsOverride.length > 0 ? entry.tagsOverride : entry.anime.tags;
  const coverOverride = nonEmpty(entry.coverUrlOverride);

  return {
    title,
    subtitle,
    coverUrl:
      coverOverride ??
      nonEmpty(entry.anime.thumbnailUrl) ??
      nonEmpty(entry.anime.imageUrl) ??
      null,
    animeType: nonEmpty(entry.animeTypeOverride) ?? entry.anime.animeType,
    tags,
    sourceLabel: entry.anime.source,
    isOverridden:
      nonEmpty(entry.displayTitleOverride) !== null ||
      nonEmpty(entry.coverUrlOverride) !== null ||
      nonEmpty(entry.animeTypeOverride) !== null ||
      entry.tagsOverride.length > 0 ||
      nonEmpty(entry.overrideNote ?? null) !== null,
    isCoverOverridden: coverOverride !== null
  };
}

function nonEmpty(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstDistinctTitle(title: string, candidates: (string | null | undefined)[]): string | null {
  const normalizedTitle = normalizeForCompare(title);

  for (const candidate of candidates) {
    const value = nonEmpty(candidate);

    if (value !== null && normalizeForCompare(value) !== normalizedTitle) {
      return value;
    }
  }

  return null;
}

function normalizeForCompare(value: string): string {
  return value.trim().toLocaleLowerCase();
}
