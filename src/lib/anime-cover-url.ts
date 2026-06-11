export interface AnimeCoverUrlFields {
  display?: {
    coverUrl: string | null;
    isCoverOverridden?: boolean;
  };
  coverUrlOverride?: string | null;
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  imageSmallUrl?: string | null;
  imageMediumUrl?: string | null;
  imageLargeUrl?: string | null;
}

export type AnimeCoverIntent = "thumbnail" | "display" | "hero";

export function getAnimeCoverUrl(
  anime: AnimeCoverUrlFields,
  options: { intent?: AnimeCoverIntent } = {}
): string | null {
  const intent = options.intent ?? "thumbnail";
  const explicitOverride = nonEmpty(anime.coverUrlOverride);
  const displayCover = nonEmpty(anime.display?.coverUrl);
  const genericCover = nonEmpty(anime.coverUrl);
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
