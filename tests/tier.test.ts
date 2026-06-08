import { describe, expect, it } from "vitest";
import {
  buildTierList,
  calculateRankingConfidence,
  calculateScoreConfidence
} from "../src/lib/tier";

describe("tier", () => {
  it("returns empty tier buckets for empty input", () => {
    expect(buildTierList([])).toEqual({
      S: [],
      A: [],
      B: [],
      C: [],
      D: []
    });
  });

  it("places a single automatic item in S", () => {
    const tiers = buildTierList([{ animeId: "a", eloScore: 1500 }]);

    expect(tiers.S.map((item) => item.animeId)).toEqual(["a"]);
  });

  it("assigns automatic items by percentile and sorts by Elo", () => {
    const scores = Array.from({ length: 10 }, (_, index) => ({
      animeId: `anime-${index}`,
      eloScore: 2000 - index * 10
    }));
    const tiers = buildTierList(scores);

    expect(tiers.S).toHaveLength(1);
    expect(tiers.A).toHaveLength(2);
    expect(tiers.B).toHaveLength(3);
    expect(tiers.C).toHaveLength(3);
    expect(tiers.D).toHaveLength(1);
    expect(tiers.S[0].animeId).toBe("anime-0");
  });

  it("keeps locked manual items in manual tiers without changing Elo", () => {
    const tiers = buildTierList([
      { animeId: "auto", eloScore: 2000 },
      {
        animeId: "manual",
        eloScore: 1200,
        manualTier: "S",
        manualRank: 1,
        manualLocked: true
      }
    ]);

    expect(tiers.S.map((item) => item.animeId)).toContain("manual");
    expect(tiers.S.find((item) => item.animeId === "manual")?.eloScore).toBe(1200);
  });

  it("calculates confidence within 0-100", () => {
    expect(calculateScoreConfidence(30, 80)).toBe(100);
    expect(calculateScoreConfidence(0, 500)).toBe(0);
    expect(
      calculateRankingConfidence([
        { animeId: "a", eloScore: 1700, compareCount: 30, uncertainty: 80 },
        { animeId: "b", eloScore: 1500, compareCount: 20, uncertainty: 120 }
      ])
    ).toBeGreaterThan(0);
  });

  it("rejects invalid scores", () => {
    expect(() => buildTierList([{ animeId: "", eloScore: 1500 }])).toThrow();
    expect(() => buildTierList([{ animeId: "a", eloScore: Number.NaN }])).toThrow();
  });
});
