/**
 * Tier artwork is not a poster. Keep the source URL unchanged in persistence,
 * and generate a cached, context-specific thumbnail only for image-led entries.
 */
export type SmartCoverVariant = "card" | "tier";

export function needsSmartCover(
  source: string | null | undefined,
  url: string | null | undefined
): boolean {
  return source === "CUSTOM_UPLOAD" ||
    source === "TIERMAKER_IMPORT" ||
    // Old share snapshots may predate `source`, so identify uploads by path too.
    !!url?.startsWith("/uploads/anime-covers/") ||
    !!url?.startsWith("/uploads/custom-items/");
}

export function smartCoverUrl(
  url: string | null | undefined,
  source: string | null | undefined,
  variant: SmartCoverVariant
): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (!needsSmartCover(source, value)) return value;
  // The route accepts only uploaded files and URLs validated by image-proxy.
  if (!/^https?:\/\//i.test(value) &&
    !/^\/uploads\/(?:anime-covers|custom-items)\/[a-zA-Z0-9._-]+$/.test(value)) {
    return value;
  }
  return `/api/cover-thumbnail?variant=${variant}&src=${encodeURIComponent(value)}`;
}
