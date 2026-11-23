import { describe, expect, it } from "vitest";
import { computeCommunityDivergence, buildPersonalItemList } from "../src/lib/community-divergence";
import type { CommunityRankingItem, TierListItem } from "../src/lib/client-api";
import type { TierRowConfig } from "../src/lib/tier-config";

const DEFAULT_TIER_ROWS: TierRowConfig[] = [
  { id: "s", label: "S", color: "#ff7ab6", order: 0 },
  { id: "a", label: "A", color: "#a78bfa", order: 1 },
  { id: "b", label: "B", color: "#60a5fa", order: 2 },
  { id: "c", label: "C", color: "#34d399", order: 3 },
  { id: "d", label: "D", color: "#94a3b8", order: 4 }
];

function makeCommunityItem(
  overrides: Partial<CommunityRankingItem> = {}
): CommunityRankingItem {
  return {
    animeId: "anime-1",
    title: "作品标题",
    imageUrl: "https://example.com/cover.jpg",
    averageRating: 1500,
    communityScore: 1500,
    participantCount: 5,
    comparisonCount: 10,
    rank: 1,
    insufficientSample: false,
    ...overrides
  };
}

function makePersonalItems(
  items: Array<{ animeId: string; tierKey: string; title?: string }>
): { tiers: Record<string, TierListItem[]>; items: TierListItem[] } {
  const tiers: Record<string, TierListItem[]> = {};
  for (const item of items) {
    const key = item.tierKey.toLowerCase();
    if (!tiers[key]) tiers[key] = [];
    tiers[key].push({
      animeId: item.animeId,
      title: item.title ?? item.animeId,
      eloScore: 0,
      id: item.animeId
    } as TierListItem);
  }
  return { tiers, items: buildPersonalItemList(tiers) };
}

describe("computeCommunityDivergence", () => {
  it("returns insufficientCommunity when no sufficient community items", () => {
    const personal = makePersonalItems([{ animeId: "anime-1", tierKey: "s" }]);
    const community: CommunityRankingItem[] = [];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientCommunity).toBe(true);
    expect(result.userLikesMore).toBeNull();
    expect(result.userLikesLess).toBeNull();
    expect(result.mostAligned).toBeNull();
  });

  it("returns insufficientPersonal when no personal items", () => {
    const personal = makePersonalItems([]);
    const community = [makeCommunityItem({ animeId: "anime-1" })];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientPersonal).toBe(true);
  });

  it("detects when user ranks higher than community", () => {
    const personal = makePersonalItems([
      { animeId: "anime-1", tierKey: "S" },
      { animeId: "anime-2", tierKey: "B" }
    ]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 1300, rank: 10, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-2", communityScore: 1600, rank: 1, participantCount: 5 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientCommunity).toBe(false);
    expect(result.userLikesMore).not.toBeNull();
    if (result.userLikesMore) {
      expect(result.userLikesMore.personalTierIndex).toBeLessThan(result.userLikesMore.communityTierIndex);
    }
  });

  it("detects when user ranks lower than community", () => {
    const personal = makePersonalItems([
      { animeId: "anime-1", tierKey: "D" },
      { animeId: "anime-2", tierKey: "B" }
    ]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 1500, rank: 3, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-2", communityScore: 1400, rank: 5, participantCount: 5 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientCommunity).toBe(false);
    expect(result.userLikesLess).not.toBeNull();
    if (result.userLikesLess) {
      expect(result.userLikesLess.personalTierIndex).toBeGreaterThan(result.userLikesLess.communityTierIndex);
    }
  });

  it("finds most aligned when user and community rank similarly", () => {
    const personal = makePersonalItems([
      { animeId: "anime-1", tierKey: "S" },
      { animeId: "anime-2", tierKey: "C" },
      { animeId: "anime-3", tierKey: "B" }
    ]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 2000, rank: 1, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-2", communityScore: 1300, rank: 10, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-3", communityScore: 1500, rank: 6, participantCount: 5 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientCommunity).toBe(false);
    expect(result.mostAligned).not.toBeNull();
    if (result.mostAligned) {
      expect(Math.abs(result.mostAligned.divergence)).toBeLessThanOrEqual(
        Math.abs(result.userLikesMore?.divergence ?? Infinity)
      );
      expect(Math.abs(result.mostAligned.divergence)).toBeLessThanOrEqual(
        Math.abs(result.userLikesLess?.divergence ?? Infinity)
      );
    }
  });

  it("returns null for userLikesMore when personal is never higher", () => {
    const personal = makePersonalItems([
      { animeId: "anime-1", tierKey: "D" },
      { animeId: "anime-2", tierKey: "D" }
    ]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 2000, rank: 1, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-2", communityScore: 1900, rank: 2, participantCount: 5 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.userLikesMore).toBeNull();
    expect(result.userLikesLess).not.toBeNull();
  });

  it("returns null for userLikesLess when personal is never lower", () => {
    const personal = makePersonalItems([
      { animeId: "anime-1", tierKey: "S" },
      { animeId: "anime-2", tierKey: "S" }
    ]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 1000, rank: 10, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-2", communityScore: 900, rank: 11, participantCount: 5 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.userLikesLess).toBeNull();
    expect(result.userLikesMore).not.toBeNull();
  });

  it("ignores insufficientSample community items", () => {
    const personal = makePersonalItems([{ animeId: "anime-1", tierKey: "S" }]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 1000, insufficientSample: true })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientCommunity).toBe(true);
  });

  it("ignores community items with null communityScore", () => {
    const personal = makePersonalItems([{ animeId: "anime-1", tierKey: "S" }]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: null as unknown as number, rank: null as unknown as number })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientCommunity).toBe(true);
  });

  it("only compares overlapping anime between personal and community", () => {
    const personal = makePersonalItems([
      { animeId: "anime-1", tierKey: "S" },
      { animeId: "anime-2", tierKey: "S" }
    ]);

    const community = [
      makeCommunityItem({ animeId: "anime-2", communityScore: 1400, rank: 5, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-3", communityScore: 1200, rank: 8, participantCount: 5 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientCommunity).toBe(false);
    expect(result.mostAligned?.animeId).toBe("anime-2");
  });

  it("includes participant count in divergence items", () => {
    const personal = makePersonalItems([{ animeId: "anime-1", tierKey: "S" }]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 1400, rank: 5, participantCount: 12 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.mostAligned?.participantCount).toBe(12);
  });

  it("handles custom tier labels", () => {
    const tierRows: TierRowConfig[] = [
      { id: "sss", label: "SSS", color: "#ff0000", order: 0 },
      { id: "ss", label: "SS", color: "#ff4000", order: 1 },
      { id: "s", label: "S", color: "#ff8000", order: 2 }
    ];

    const personal = makePersonalItems([
      { animeId: "anime-1", tierKey: "SSS" },
      { animeId: "anime-2", tierKey: "S" }
    ]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 1000, rank: 10, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-2", communityScore: 2000, rank: 1, participantCount: 5 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      tierRows,
      community
    );

    if (result.userLikesMore) {
      expect(result.userLikesMore.personalTierLabel).toBe("SSS");
    }
    if (result.userLikesLess) {
      expect(result.userLikesLess.communityTierLabel).toBe("SSS");
    }
  });

  it("returns correct tier labels in divergence items", () => {
    const personal = makePersonalItems([
      { animeId: "anime-1", tierKey: "S" },
      { animeId: "anime-2", tierKey: "D" }
    ]);

    const community = [
      makeCommunityItem({ animeId: "anime-1", communityScore: 1200, rank: 12, participantCount: 5 }),
      makeCommunityItem({ animeId: "anime-2", communityScore: 1800, rank: 1, participantCount: 5 })
    ];

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    if (result.userLikesMore) {
      expect(result.userLikesMore.personalTierLabel).toBe("S");
      expect(typeof result.userLikesMore.communityTierLabel).toBe("string");
    }
    if (result.userLikesLess) {
      expect(result.userLikesLess.personalTierLabel).toBe("D");
      expect(typeof result.userLikesLess.communityTierLabel).toBe("string");
    }
  });

  it("handles many items distributed across tiers", () => {
    const personal = makePersonalItems(
      Array.from({ length: 10 }, (_, i) => ({
        animeId: `anime-${i + 1}`,
        tierKey: i < 3 ? "S" : i < 5 ? "D" : "B"
      }))
    );

    const community = Array.from({ length: 10 }, (_, i) =>
      makeCommunityItem({
        animeId: `anime-${i + 1}`,
        communityScore: 2000 - i * 100,
        rank: i + 1,
        participantCount: 5 + i
      })
    );

    const result = computeCommunityDivergence(
      personal.items,
      personal.tiers,
      DEFAULT_TIER_ROWS,
      community
    );

    expect(result.insufficientCommunity).toBe(false);
    expect(result.insufficientPersonal).toBe(false);
    expect(result.userLikesMore).not.toBeNull();
    expect(result.userLikesLess).not.toBeNull();
    expect(result.mostAligned).not.toBeNull();
  });
});

describe("buildPersonalItemList", () => {
  it("flattens tiers into a single list", () => {
    const tiers: Record<string, TierListItem[]> = {
      s: [
        { animeId: "a1", id: "a1", title: "A1", eloScore: 0 } as TierListItem,
        { animeId: "a2", id: "a2", title: "A2", eloScore: 0 } as TierListItem
      ],
      a: [
        { animeId: "a3", id: "a3", title: "A3", eloScore: 0 } as TierListItem
      ]
    };

    const items = buildPersonalItemList(tiers);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.animeId).sort()).toEqual(["a1", "a2", "a3"]);
  });

  it("returns empty list for empty tiers", () => {
    expect(buildPersonalItemList({})).toEqual([]);
  });
});
