export interface AnimeCoverUrlFields {
  display?: {
    coverUrl: string | null;
    isCoverOverridden?: boolean;
  };
  coverUrlOverride?: string | null;
  coverUrl?: string | null;
  posterUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  imageSmallUrl?: string | null;
  imageMediumUrl?: string | null;
  imageLargeUrl?: string | null;
}

export type AnimeCoverIntent = "thumbnail" | "display" | "hero" | "export";

export function getAnimeCoverUrl(
  anime: AnimeCoverUrlFields,
  options: { intent?: AnimeCoverIntent } = {}
): string | null {
  const intent = options.intent ?? "thumbnail";
  const explicitOverride = nonEmpty(anime.coverUrlOverride);
  const displayCover = nonEmpty(anime.display?.coverUrl);
  const genericCover = nonEmpty(anime.coverUrl);
  const posterUrl = nonEmpty(anime.posterUrl);
  const imageUrl = nonEmpty(anime.imageUrl);
  const thumbnailUrl = nonEmpty(anime.thumbnailUrl);
  const imageSmallUrl = nonEmpty(anime.imageSmallUrl);
  const imageMediumUrl = nonEmpty(anime.imageMediumUrl);
  const imageLargeUrl = nonEmpty(anime.imageLargeUrl);
  const displayCoverOverride =
    anime.display?.isCoverOverridden === true ? displayCover : null;

  const override = explicitOverride ?? displayCoverOverride;

  if (override !== null) {
    return override;
  }

  const localUpload = firstLocalUpload([
    displayCover,
    genericCover,
    imageUrl,
    thumbnailUrl,
    imageMediumUrl,
    imageSmallUrl,
    imageLargeUrl
  ]);

  if (localUpload !== null) {
    return localUpload;
  }

  if (intent === "thumbnail") {
    return (
      displayCover ??
      genericCover ??
      thumbnailUrl ??
      imageUrl ??
      imageSmallUrl ??
      imageMediumUrl ??
      imageLargeUrl ??
      null
    );
  }

  if (intent === "export") {
    return pickCover({
      imageUrl,
      imageMediumUrl,
      imageLargeUrl,
      thumbnailUrl,
      imageSmallUrl,
      displayCover,
      genericCover,
      posterUrl
    });
  }

  if (intent === "display" || intent === "hero") {
    return pickCover({
      imageUrl,
      imageMediumUrl,
      imageLargeUrl,
      thumbnailUrl,
      imageSmallUrl,
      displayCover,
      genericCover
    });
  }

  return (
    imageUrl ??
    imageMediumUrl ??
    imageLargeUrl ??
    thumbnailUrl ??
    imageSmallUrl ??
    displayCover ??
    genericCover ??
    null
  );
}

interface CoverCandidates {
  imageUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  thumbnailUrl: string | null;
  imageSmallUrl: string | null;
  displayCover: string | null;
  genericCover: string | null;
  posterUrl?: string | null;
}

function pickCover(candidates: CoverCandidates): string | null {
  return (
    candidates.imageUrl ??
    candidates.imageMediumUrl ??
    candidates.imageLargeUrl ??
    candidates.thumbnailUrl ??
    candidates.imageSmallUrl ??
    candidates.displayCover ??
    candidates.genericCover ??
    candidates.posterUrl ??
    null
  );
}

function nonEmpty(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstLocalUpload(values: (string | null)[]): string | null {
  return (
    values.find(
      (value) =>
        value !== null &&
        (value.startsWith("/uploads/custom-items/") ||
          value.startsWith("/uploads/anime-covers/"))
    ) ?? null
  );
}
