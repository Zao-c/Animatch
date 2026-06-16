import { formatAnimeSource } from "./anime-source";

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

export type AnimeDisplaySource = {
  source?: string | null;
  title?: string | null;
  titleCn?: string | null;
  titleJa?: string | null;
  titleEn?: string | null;
  display?: {
    title?: string | null;
    subtitle?: string | null;
  } | null;
};

export interface PoolAnimeDisplayFields {
  displayTitleOverride: string | null;
  coverUrlOverride: string | null;
  animeTypeOverride: string | null;
  tagsOverride: string[];
  overrideNote?: string | null;
  anime: AnimeDisplayFields;
}

export const UNNAMED_ANIME_TITLE = "未命名作品";

export function getEffectiveAnimeDisplay(
  entry: PoolAnimeDisplayFields
): EffectiveAnimeDisplay {
  const rawTitle =
    nonEmpty(entry.displayTitleOverride) ??
    nonEmpty(entry.anime.titleCn) ??
    nonEmpty(entry.anime.title) ??
    nonEmpty(entry.anime.titleJa) ??
    nonEmpty(entry.anime.titleEn) ??
    "Untitled anime";
  const title =
    isUserGeneratedImageSource(entry.anime.source) && isGeneratedOrNoisyTitle(rawTitle)
      ? UNNAMED_ANIME_TITLE
      : rawTitle;
  const subtitle =
    title === UNNAMED_ANIME_TITLE
      ? null
      : firstDistinctTitle(title, [
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
    sourceLabel: formatAnimeSource(entry.anime.source),
    isOverridden:
      nonEmpty(entry.displayTitleOverride) !== null ||
      nonEmpty(entry.coverUrlOverride) !== null ||
      nonEmpty(entry.animeTypeOverride) !== null ||
      entry.tagsOverride.length > 0 ||
      nonEmpty(entry.overrideNote ?? null) !== null,
    isCoverOverridden: coverOverride !== null
  };
}

export function isUserGeneratedImageSource(source: string | null | undefined): boolean {
  return source === "TIERMAKER_IMPORT" || source === "CUSTOM_UPLOAD";
}

export function isImageFocusedSource(source: string | null | undefined): boolean {
  return isUserGeneratedImageSource(source);
}

export function isGeneratedOrNoisyTitle(title: string): boolean {
  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return true;
  }

  if (/https?:\/\//i.test(trimmed) || /tiermaker\.com/i.test(trimmed)) {
    return true;
  }

  if (/\d{10,}/.test(trimmed)) {
    return true;
  }

  const compact = trimmed.replace(/[\s._-]/g, "");
  if (/^[a-f0-9]{16,}$/i.test(compact)) {
    return true;
  }

  const tokens = trimmed.split(/[\s._-]+/).filter(Boolean);
  const hasHashLikeToken = tokens.some((token) => /^[a-f0-9]{8,}$/i.test(token));
  if (trimmed.length > 40 && hasHashLikeToken) {
    return true;
  }

  if (trimmed.length > 64 && /^[a-z0-9\s._-]+$/i.test(trimmed) && tokens.length >= 3) {
    return true;
  }

  return false;
}

export function getAnimeDisplayTitle(anime: AnimeDisplaySource): string {
  const title =
    anime.display?.title ??
    anime.titleCn ??
    anime.titleJa ??
    anime.titleEn ??
    anime.title ??
    "";

  if (isUserGeneratedImageSource(anime.source) && isGeneratedOrNoisyTitle(title)) {
    return UNNAMED_ANIME_TITLE;
  }

  return title.trim() || UNNAMED_ANIME_TITLE;
}

export function getAnimeDisplaySubtitle(anime: AnimeDisplaySource): string | null {
  if (anime.display?.subtitle !== undefined) {
    return anime.display.subtitle;
  }

  const title = anime.title ?? "";
  const displayTitle = getAnimeDisplayTitle(anime);
  if (displayTitle === UNNAMED_ANIME_TITLE || title.trim() === displayTitle) {
    return null;
  }

  return title.trim() || null;
}

export function shouldUseContainCover(anime: AnimeDisplaySource): boolean {
  return isUserGeneratedImageSource(anime.source);
}

export function getAnimeImageFitMode(anime: AnimeDisplaySource): "cover" | "contain" {
  return shouldUseContainCover(anime) ? "contain" : "cover";
}

export function shouldShowAnimeTitle(anime: AnimeDisplaySource): boolean {
  return getAnimeDisplayTitle(anime).length > 0;
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
