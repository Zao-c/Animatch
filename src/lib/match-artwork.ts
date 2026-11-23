import {
  getAnimeCoverUrl,
  getAnimeSourceCoverCandidates,
  type AnimeCoverUrlFields
} from "./anime-cover-url";
import { smartCoverUrl } from "./smart-cover-url";

export type MatchArtworkFields = AnimeCoverUrlFields & { source?: string | null };

/**
 * Duel cards are much larger than list cards. For imported character art,
 * generate the high-resolution derivative from the original URL/file rather
 * than from a possibly 600px-wide COS mirror. Keep that mirror as fallback.
 */
export function getMatchArtwork(anime: MatchArtworkFields) {
  const heroUrl = getAnimeCoverUrl(anime, { intent: "hero" });
  const originalSources = getAnimeSourceCoverCandidates(anime);
  const isImportedArtwork = anime.source === "CUSTOM_UPLOAD" || anime.source === "TIERMAKER_IMPORT";
  const hasExplicitOverride =
    Boolean(anime.coverUrlOverride?.trim()) || anime.display?.isCoverOverridden === true;

  const preferredOriginal = !hasExplicitOverride && isImportedArtwork
    ? (originalSources[0] ?? heroUrl)
    : heroUrl;
  const processedUrl = smartCoverUrl(preferredOriginal, anime.source, "match");
  const usesSmartCover = processedUrl !== preferredOriginal;

  // If the raw remote TierMaker image cannot be fetched, fall back to a
  // derivative of the existing COS cache before considering unprocessed art.
  const cachedProcessedUrl = heroUrl && heroUrl !== preferredOriginal
    ? smartCoverUrl(heroUrl, anime.source, "match")
    : null;
  const secondarySrc = cachedProcessedUrl && cachedProcessedUrl !== heroUrl
    ? cachedProcessedUrl
    : (usesSmartCover ? preferredOriginal : originalSources.find((url) => url !== preferredOriginal));

  return {
    src: processedUrl,
    secondarySrc,
    fallbackSrcs: Array.from(new Set(
      [heroUrl, preferredOriginal, ...originalSources].filter((url): url is string => !!url)
    )),
    fit: usesSmartCover ? "cover" as const : "contain" as const
  };
}
