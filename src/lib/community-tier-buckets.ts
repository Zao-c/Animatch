import type {
  CommunityRankingItem,
  TierShareSnapshotItem,
  TierShareSnapshotTier
} from "@/lib/client-api";
import type { TierRowConfig } from "@/lib/tier-config";

export interface CommunityTierBuckets {
  buckets: Record<string, CommunityRankingItem[]>;
  insufficient: CommunityRankingItem[];
}

export const COMMUNITY_INSUFFICIENT_TIER_ROW: TierRowConfig = {
  id: "insufficient",
  label: "样本不足",
  color: "#94a3b8",
  order: 999
};

export function buildCommunityTierBuckets(
  items: CommunityRankingItem[],
  rows: TierRowConfig[]
): CommunityTierBuckets {
  const sufficient = items.filter((item) => !item.insufficientSample);
  const sorted = [...sufficient].sort(
    (a, b) => (b.communityScore ?? 0) - (a.communityScore ?? 0)
  );
  const n = sorted.length;

  const emptyBuckets: Record<string, CommunityRankingItem[]> = {};
  for (const row of rows) {
    emptyBuckets[row.id] = [];
  }

  if (rows.length === 0) {
    return { buckets: emptyBuckets, insufficient: items };
  }

  if (n === 0) {
    return { buckets: emptyBuckets, insufficient: items };
  }

  if (n <= 3) {
    emptyBuckets[rows[0].id] = sorted.slice(0, 1);
    for (let index = 1; index < rows.length && index < n; index += 1) {
      emptyBuckets[rows[index].id] = [sorted[index]];
    }
    const remaining = sorted.slice(Math.min(rows.length, n));
    if (remaining.length > 0) {
      emptyBuckets[rows[rows.length - 1].id].push(...remaining);
    }
    return {
      buckets: emptyBuckets,
      insufficient: items.filter((item) => item.insufficientSample)
    };
  }

  if (n <= 7) {
    const top20 = Math.ceil(n * 0.2);
    const top50 = Math.ceil(n * 0.5);
    const top80 = Math.ceil(n * 0.8);
    emptyBuckets[rows[0].id] = sorted.slice(0, top20);
    if (rows.length >= 2) emptyBuckets[rows[1].id] = sorted.slice(top20, top50);
    if (rows.length >= 3) emptyBuckets[rows[2].id] = sorted.slice(top50, top80);
    if (rows.length >= 4) emptyBuckets[rows[3].id] = sorted.slice(top80);
    return {
      buckets: emptyBuckets,
      insufficient: items.filter((item) => item.insufficientSample)
    };
  }

  if (rows.length === 5 && n > 7) {
    const sEnd = Math.max(1, Math.round(n * 0.1));
    const aEnd = Math.max(sEnd + 1, Math.round(n * 0.3));
    const bEnd = Math.max(aEnd + 1, Math.round(n * 0.6));
    const cEnd = Math.max(bEnd + 1, Math.round(n * 0.85));
    emptyBuckets[rows[0].id] = sorted.slice(0, sEnd);
    emptyBuckets[rows[1].id] = sorted.slice(sEnd, aEnd);
    emptyBuckets[rows[2].id] = sorted.slice(aEnd, bEnd);
    emptyBuckets[rows[3].id] = sorted.slice(bEnd, cEnd);
    emptyBuckets[rows[4].id] = sorted.slice(cEnd);
    return {
      buckets: emptyBuckets,
      insufficient: items.filter((item) => item.insufficientSample)
    };
  }

  const bucketSize = 1 / rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const start = Math.round(index * bucketSize * n);
    const end = index === rows.length - 1 ? n : Math.round((index + 1) * bucketSize * n);
    emptyBuckets[rows[index].id] = sorted.slice(start, end);
  }

  return {
    buckets: emptyBuckets,
    insufficient: items.filter((item) => item.insufficientSample)
  };
}

export function buildCommunityTierShareTiers(
  items: CommunityRankingItem[],
  rows: TierRowConfig[]
): TierShareSnapshotTier[] {
  const { buckets, insufficient } = buildCommunityTierBuckets(items, rows);
  const tiers = rows.map((row) => ({
    key: row.id,
    label: row.label,
    color: row.color,
    items: (buckets[row.id] ?? []).map(toShareItem)
  }));

  if (insufficient.length > 0) {
    tiers.push({
      key: COMMUNITY_INSUFFICIENT_TIER_ROW.id,
      label: COMMUNITY_INSUFFICIENT_TIER_ROW.label,
      color: COMMUNITY_INSUFFICIENT_TIER_ROW.color,
      items: insufficient.map(toShareItem)
    });
  }

  return tiers;
}

function toShareItem(item: CommunityRankingItem): TierShareSnapshotItem {
  return {
    animeId: item.animeId,
    title: item.title,
    coverUrl: item.imageUrl,
    imageUrl: item.imageUrl,
    imageMediumUrl: item.imageUrl,
    imageLargeUrl: item.imageUrl,
    source: "community",
    elo: item.communityScore ?? item.averageRating ?? undefined
  };
}
