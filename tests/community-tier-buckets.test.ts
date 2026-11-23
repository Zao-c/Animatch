import { describe, expect, it } from "vitest";
import type { CommunityRankingItem } from "@/lib/client-api";
import {
  buildCommunityTierBuckets,
  buildCommunityTierShareTiers
} from "@/lib/community-tier-buckets";
import { DEFAULT_TIER_CONFIG } from "@/lib/tier-config";

function item(
  animeId: string,
  score: number,
  insufficientSample = false
): CommunityRankingItem {
  return {
    animeId,
    title: `Anime ${animeId}`,
    imageUrl: `https://example.test/${animeId}.jpg`,
    averageRating: score,
    communityScore: score,
    participantCount: insufficientSample ? 1 : 3,
    comparisonCount: insufficientSample ? 2 : 8,
    rank: insufficientSample ? null : Number(animeId),
    insufficientSample
  };
}

describe("community tier buckets", () => {
  it("keeps insufficient samples out of official percentile buckets", () => {
    const rows = DEFAULT_TIER_CONFIG.rows;
    const result = buildCommunityTierBuckets(
      [
        item("1", 1800),
        item("2", 1700),
        item("3", 1600),
        item("4", 1500, true)
      ],
      rows
    );

    expect(result.buckets[rows[0].id]).toHaveLength(1);
    expect(result.buckets[rows[0].id][0].animeId).toBe("1");
    expect(result.insufficient.map((entry) => entry.animeId)).toEqual(["4"]);
  });

  it("builds export tiers with a dedicated insufficient-sample row", () => {
    const tiers = buildCommunityTierShareTiers(
      [
        item("1", 1800),
        item("2", 1700),
        item("3", 1600),
        item("4", 1500, true)
      ],
      DEFAULT_TIER_CONFIG.rows
    );

    expect(tiers.map((tier) => tier.key)).toContain("insufficient");
    expect(tiers.at(-1)?.label).toBe("样本不足");
    expect(tiers.at(-1)?.items[0]).toMatchObject({
      animeId: "4",
      title: "Anime 4",
      imageUrl: "https://example.test/4.jpg",
      source: "community"
    });
  });

  it("preserves original cover variants when the public ranking uses COS", () => {
    const cachedItem = item("1", 1800);
    cachedItem.imageUrl = "https://bucket.cos.ap-shanghai.myqcloud.com/animatch/covers/1.webp";
    cachedItem.sourceImageUrl = "https://lain.bgm.tv/pic/cover/c/1.jpg";
    cachedItem.imageLargeUrl = "https://lain.bgm.tv/pic/cover/l/1.jpg";
    const exported = buildCommunityTierShareTiers([cachedItem], DEFAULT_TIER_CONFIG.rows);
    expect(exported[0].items[0]).toMatchObject({
      coverUrl: cachedItem.imageUrl,
      imageUrl: cachedItem.sourceImageUrl,
      imageLargeUrl: cachedItem.imageLargeUrl
    });
  });
});
