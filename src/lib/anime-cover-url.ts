export interface AnimeCoverUrlFields {
  display?: {
    coverUrl: string | null;
  };
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

export function getAnimeCoverUrl(anime: AnimeCoverUrlFields): string | null {
  return (
    nonEmpty(anime.display?.coverUrl) ??
    nonEmpty(anime.coverUrl) ??
    nonEmpty(anime.thumbnailUrl) ??
    nonEmpty(anime.imageUrl) ??
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
