import { getAnimeCoverUrl, type AnimeCoverUrlFields } from "./anime-cover-url";
import { getAnimeDisplayTitle, getAnimeImageFitMode, isUserGeneratedImageSource } from "./anime-display";
import { proxyExternalImageUrl } from "./image-proxy";

export interface ExportImageDiagnostic {
  animeId: string;
  displayTitle: string;
  rawTitle: string | null;
  sourceType: string | null;
  hasOverride: boolean;
  selectedImageUrl: string | null;
  selectedUrlIsLocal: boolean;
  proxiedImageUrl: string | null;
  hasImage: boolean;
  fitMode: string;
}

export function buildTierExportImageSources(
  tierRows: (AnimeCoverUrlFields & {
    animeId?: string;
    title?: string | null;
    titleCn?: string | null;
    source?: string | null;
  })[]
): ExportImageDiagnostic[] {
  return tierRows.map((item) => {
    const rawTitle = item.titleCn ?? item.title ?? null;
    const displayTitle = getAnimeDisplayTitle(item as Parameters<typeof getAnimeDisplayTitle>[0]);
    const selectedImageUrl = getAnimeCoverUrl(item, { intent: "export" });
    const proxiedImageUrl = proxyExternalImageUrl(selectedImageUrl);
    const sourceType = item.source ?? null;
    const hasOverride = item.coverUrlOverride !== undefined && item.coverUrlOverride !== null;

    return {
      animeId: item.animeId ?? "unknown",
      displayTitle,
      rawTitle,
      sourceType,
      hasOverride,
      selectedImageUrl,
      selectedUrlIsLocal:
        selectedImageUrl !== null && selectedImageUrl.startsWith("/"),
      proxiedImageUrl,
      hasImage: selectedImageUrl !== null && selectedImageUrl.length > 0,
      fitMode: getAnimeImageFitMode(
        item as Parameters<typeof getAnimeImageFitMode>[0]
      )
    };
  });
}

export function assertExportImageSources(
  diagnostics: ExportImageDiagnostic[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const diag of diagnostics) {
    if (diag.hasImage && diag.proxiedImageUrl === null) {
      errors.push(
        `${diag.animeId}: has image URL "${diag.selectedImageUrl}" but proxied is null`
      );
    }

    if (!diag.hasImage) {
      warnings.push(`${diag.animeId}: no image URL available`);
    }

    if (
      diag.hasImage &&
      diag.proxiedImageUrl !== null &&
      diag.proxiedImageUrl.includes("undefined") &&
      !diag.selectedImageUrl?.includes("undefined")
    ) {
      errors.push(
        `${diag.animeId}: proxied URL contains "undefined": ${diag.proxiedImageUrl}`
      );
    }

    if (
      diag.hasImage &&
      diag.proxiedImageUrl !== null &&
      diag.proxiedImageUrl.startsWith("/api/image-proxy?url=%2Fapi%2Fimage-proxy")
    ) {
      errors.push(`${diag.animeId}: double-proxied URL: ${diag.proxiedImageUrl}`);
    }

    if (!diag.hasImage && !isUserGeneratedImageSource(diag.sourceType)) {
      warnings.push(
        `${diag.animeId} (${diag.sourceType}): no image for non-user-generated source`
      );
    }
  }

  return { errors, warnings };
}
