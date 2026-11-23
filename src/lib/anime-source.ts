export const ANIME_SOURCE = {
  BANGUMI: "BANGUMI",
  MANAMI: "MANAMI",
  CUSTOM_UPLOAD: "CUSTOM_UPLOAD",
  MANUAL: "MANUAL",
  DEMO: "DEMO",
  TIERMAKER_IMPORT: "TIERMAKER_IMPORT"
} as const;

export const TIERMAKER_IMPORT_SOURCE = ANIME_SOURCE.TIERMAKER_IMPORT;

const SOURCE_LABELS: Record<string, string> = {
  [ANIME_SOURCE.BANGUMI]: "Bangumi",
  [ANIME_SOURCE.MANAMI]: "Manami",
  [ANIME_SOURCE.CUSTOM_UPLOAD]: "Custom upload",
  [ANIME_SOURCE.MANUAL]: "Manual",
  [ANIME_SOURCE.DEMO]: "Demo",
  [ANIME_SOURCE.TIERMAKER_IMPORT]: "TierMaker",
  MIXED: "Mixed",
  UNKNOWN: "Unknown"
};

export function formatAnimeSource(source: string | null | undefined): string {
  if (!source) {
    return SOURCE_LABELS.UNKNOWN;
  }

  return SOURCE_LABELS[source] ?? source;
}
