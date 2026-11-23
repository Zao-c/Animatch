import type { BangumiSearchItem, PublicAnime } from "./client-api";

export type DiscoverySource = "bangumi" | "local";
export interface DiscoveryFilters {
  source: DiscoverySource;
  q: string;
  yearFrom: string;
  yearTo: string;
  month?: string;
  type: string;
  tags: string[];
  sort: string;
}
export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  source: "bangumi", q: "", yearFrom: "", yearTo: "", month: "", type: "", tags: [], sort: "match"
};

export function validateDiscoveryYears(filters: Pick<DiscoveryFilters, "yearFrom" | "yearTo" | "month">): string | null {
  for (const value of [filters.yearFrom, filters.yearTo]) {
    if (value && (!/^\d{4}$/.test(value) || Number(value) < 1900 || Number(value) > 2100)) return "年份请填写 1900–2100 之间的四位数字。";
  }
  if (filters.yearFrom && filters.yearTo && Number(filters.yearFrom) > Number(filters.yearTo)) return "开始年份不能晚于结束年份。";
  if (filters.month && (!Number.isInteger(Number(filters.month)) || Number(filters.month) < 1 || Number(filters.month) > 12)) return "月份请选择 1–12 月。";
  if (filters.month && (!filters.yearFrom || filters.yearFrom !== filters.yearTo)) return "按月份筛选时请选择一个具体年份。";
  return null;
}

/** Keep every image size: a failed thumbnail must not discard a valid full cover. */
export function bangumiSearchItemToAnime(item: BangumiSearchItem): PublicAnime {
  return {
    id: `bgm:${item.bangumiId}`, bgmId: item.bangumiId, title: item.title, titleCn: item.titleCn,
    titleJa: item.title, titleEn: null, imageUrl: item.imageUrl,
    imageSmallUrl: item.imageSmallUrl ?? null, imageMediumUrl: item.imageMediumUrl ?? null,
    imageLargeUrl: item.imageLargeUrl ?? null, coverUrl: null, thumbnailUrl: item.imageSmallUrl ?? item.imageUrl,
    bangumiScore: item.bangumiScore ?? null, bangumiRank: item.bangumiRank ?? null,
    tags: item.tags, aliases: [], year: item.year, airDate: item.airDate,
    season: null, animeType: item.animeType ?? null, studios: [], source: "BANGUMI"
  };
}

/** Strictly parse a subject reference; arbitrary URLs must never be fetched. */
export function parseBangumiReference(value: string): number | null {
  const query = value.trim();
  const match = /^(?:https?:\/\/(?:bgm\.tv|bangumi\.tv|chii\.in)\/subject\/)?([1-9]\d*)(?:\/?(?:[?#].*)?)?$/.exec(query);
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) ? id : null;
}
