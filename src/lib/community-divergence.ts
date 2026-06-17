import type { CommunityRankingItem, TierListItem } from "@/lib/client-api";
import type { TierRowConfig } from "@/lib/tier-config";

export interface DivergenceItem {
  animeId: string;
  title: string;
  imageUrl: string | null;
  personalTierLabel: string;
  personalTierIndex: number;
  communityTierLabel: string;
  communityTierIndex: number;
  divergence: number;
  participantCount: number;
}

export interface DivergenceResult {
  userLikesMore: DivergenceItem | null;
  userLikesLess: DivergenceItem | null;
  mostAligned: DivergenceItem | null;
  insufficientCommunity: boolean;
  insufficientPersonal: boolean;
}

export function computeCommunityDivergence(
  personalItems: TierListItem[],
  personalTiers: Record<string, TierListItem[]>,
  tierRows: TierRowConfig[],
  communityItems: CommunityRankingItem[]
): DivergenceResult {
  const tierIndexByKey = new Map<string, number>();
  const tierLabelByKey = new Map<string, string>();

  for (const row of tierRows) {
    tierIndexByKey.set(row.id, row.order);
    tierLabelByKey.set(row.id, row.label);
  }

  const numTiers = tierRows.length;

  const personalAnimeMap = new Map<string, { tierKey: string; tierIndex: number; tierLabel: string }>();

  for (const [tierKey, items] of Object.entries(personalTiers)) {
    const tierIndex = tierIndexByKey.get(tierKey.toLowerCase());
    const tierLabel = tierLabelByKey.get(tierKey.toLowerCase());

    if (tierIndex === undefined || tierLabel === undefined) {
      continue;
    }

    for (const item of items) {
      personalAnimeMap.set(item.animeId, { tierKey, tierIndex, tierLabel });
    }
  }

  const sufficientCommunityItems = communityItems.filter(
    (item) => !item.insufficientSample && item.communityScore !== null && item.rank !== null
  );
  const totalSufficientCommunity = sufficientCommunityItems.length;

  if (totalSufficientCommunity === 0) {
    return {
      userLikesMore: null,
      userLikesLess: null,
      mostAligned: null,
      insufficientCommunity: true,
      insufficientPersonal: personalAnimeMap.size === 0
    };
  }

  sufficientCommunityItems.sort((a, b) => (b.communityScore ?? 0) - (a.communityScore ?? 0));

  const bucketSize = Math.ceil(totalSufficientCommunity / numTiers);
  const communityTierAssignment = new Map<string, { tierIndex: number; tierLabel: string }>();

  for (let i = 0; i < sufficientCommunityItems.length; i++) {
    const tierIndex = Math.floor(i / bucketSize);
    const clampedIndex = Math.min(tierIndex, numTiers - 1);
    const row = tierRows.find((r) => r.order === clampedIndex) ?? tierRows[tierRows.length - 1];
    communityTierAssignment.set(sufficientCommunityItems[i].animeId, {
      tierIndex: clampedIndex,
      tierLabel: row.label
    });
  }

  const participantCountByAnimeId = new Map(
    communityItems.map((item) => [item.animeId, item.participantCount])
  );

  const divergences: DivergenceItem[] = [];

  for (const [animeId, personal] of personalAnimeMap) {
    const community = communityTierAssignment.get(animeId);
    if (community === undefined) {
      continue;
    }

    const divergence = community.tierIndex - personal.tierIndex;
    const communityItem = communityItems.find((item) => item.animeId === animeId);
    const communityLabel = communityItem?.title ?? animeId;
    const communityImageUrl = communityItem?.imageUrl ?? null;

    divergences.push({
      animeId,
      title: communityLabel,
      imageUrl: communityImageUrl,
      personalTierLabel: personal.tierLabel,
      personalTierIndex: personal.tierIndex,
      communityTierLabel: community.tierLabel,
      communityTierIndex: community.tierIndex,
      divergence,
      participantCount: participantCountByAnimeId.get(animeId) ?? 0
    });
  }

  let userLikesMore: DivergenceItem | null = null;
  let userLikesLess: DivergenceItem | null = null;
  let mostAligned: DivergenceItem | null = null;

  let maxDivergence = -Infinity;
  let minDivergence = Infinity;
  let minAbsDivergence = Infinity;

  for (const d of divergences) {
    if (d.divergence > maxDivergence) {
      maxDivergence = d.divergence;
      userLikesMore = d;
    }
    if (d.divergence < minDivergence) {
      minDivergence = d.divergence;
      userLikesLess = d;
    }
    if (Math.abs(d.divergence) < minAbsDivergence) {
      minAbsDivergence = Math.abs(d.divergence);
      mostAligned = d;
    }
  }

  if (userLikesMore !== null && userLikesMore.divergence <= 0) {
    userLikesMore = null;
  }
  if (userLikesLess !== null && userLikesLess.divergence >= 0) {
    userLikesLess = null;
  }

  return {
    userLikesMore,
    userLikesLess,
    mostAligned,
    insufficientCommunity: false,
    insufficientPersonal: personalAnimeMap.size === 0
  };
}

export function buildPersonalItemList(
  tiers: Record<string, TierListItem[]>
): TierListItem[] {
  return Object.values(tiers).flat();
}
