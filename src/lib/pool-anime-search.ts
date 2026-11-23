import { getEffectiveAnimeDisplay } from "./anime-display";
import type { PoolAnimeEntry } from "./client-api";

/**
 * Builds the lowercased haystack used by the pool anime wall search.
 *
 * Includes the effective display title (which honours `displayTitleOverride`
 * and noisy-title normalisation), the raw override, every stored title variant
 * and the aliases, so a renamed work is still findable by its new name as well
 * as by its original name/aliases.
 */
export function getPoolAnimeSearchText(entry: PoolAnimeEntry): string {
  const effectiveTitle = getEffectiveAnimeDisplay(entry).title;
  const parts: (string | null | undefined)[] = [
    effectiveTitle,
    entry.displayTitleOverride,
    entry.anime.title,
    entry.anime.titleCn,
    entry.anime.titleJa,
    entry.anime.titleEn,
    ...(entry.anime.aliases ?? [])
  ];

  return parts
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

export function matchesPoolAnimeSearch(entry: PoolAnimeEntry, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return true;
  }

  return getPoolAnimeSearchText(entry).includes(trimmed);
}

const SUSPICIOUS_TITLE_PATTERNS: RegExp[] = [
  /^未命名/,
  /^untitled$/i,
  /^unknown$/i,
  /^image[_\s-]?\d+$/i,
  /^\d{15,}$/
];

/**
 * "疑似脏标题" filter. Uses the effective display title so a user-corrected
 * title drops out of the suspicious list, while noisy auto-imported titles
 * (already normalised to the placeholder title) stay flagged.
 */
export function isSuspiciousPoolAnimeTitle(entry: PoolAnimeEntry): boolean {
  const title = getEffectiveAnimeDisplay(entry).title.trim();
  return SUSPICIOUS_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}
