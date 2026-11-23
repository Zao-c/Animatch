export interface AnimeCoverUrlFields {
  display?: {
    coverUrl: string | null;
    isCoverOverridden?: boolean;
  };
  coverUrlOverride?: string | null;
  coverUrl?: string | null;
  posterUrl?: string | null;
  cachedCoverUrl?: string | null;
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
  const cachedCoverUrl = nonEmpty(anime.cachedCoverUrl);
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

  if (cachedCoverUrl !== null) {
    return cachedCoverUrl;
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
    return pickRemoteFirst([
      thumbnailUrl,
      imageSmallUrl,
      imageUrl,
      imageMediumUrl,
      imageLargeUrl,
      displayCover,
      genericCover
    ]);
  }

  if (intent === "export") {
    return pickRemoteFirst([
      imageLargeUrl,
      imageMediumUrl,
      imageUrl,
      imageSmallUrl,
      thumbnailUrl,
      displayCover,
      genericCover,
      posterUrl
    ]);
  }

  if (intent === "display" || intent === "hero") {
    return pickRemoteFirst([
      imageLargeUrl,
      imageMediumUrl,
      imageUrl,
      imageSmallUrl,
      thumbnailUrl,
      displayCover,
      genericCover
    ]);
  }

  return pickRemoteFirst([
    imageLargeUrl,
    imageMediumUrl,
    imageUrl,
    imageSmallUrl,
    thumbnailUrl,
    displayCover,
    genericCover
  ]);
}

function pickRemoteFirst(candidates: (string | null)[]): string | null {
  const remote: string[] = [];
  const localSvg: string[] = [];

  for (const candidate of candidates) {
    if (candidate === null) continue;
    if (isLocalSvg(candidate)) {
      localSvg.push(candidate);
    } else {
      remote.push(candidate);
    }
  }

  return remote[0] ?? localSvg[0] ?? null;
}

function isLocalSvg(url: string): boolean {
  return url.endsWith(".svg") && !url.startsWith("http");
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
