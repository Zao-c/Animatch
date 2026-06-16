import { describe, expect, it } from "vitest";
import {
  buildTierList,
  calculateRankingConfidence,
  calculateScoreConfidence
} from "../src/lib/tier";
import { DEFAULT_TIER_CONFIG } from "../src/lib/tier-config";

const DEFAULT_ROWS = DEFAULT_TIER_CONFIG.rows;

describe("tier", () => {
  it("returns empty tier buckets for empty input", () => {
    expect(buildTierList([], DEFAULT_ROWS)).toEqual({
      s: [],
      a: [],
      b: [],
      c: [],
      d: []
    });
  });

  it("places a single automatic item in S", () => {
    const tiers = buildTierList([{ animeId: "a", eloScore: 1500 }], DEFAULT_ROWS);

    expect(tiers.s.map((item) => item.animeId)).toEqual(["a"]);
  });

  it("assigns automatic items by percentile and sorts by Elo", () => {
    const scores = Array.from({ length: 10 }, (_, index) => ({
      animeId: `anime-${index}`,
      eloScore: 2000 - index * 10
    }));
    const tiers = buildTierList(scores, DEFAULT_ROWS);

    expect(tiers.s).toHaveLength(1);
    expect(tiers.a).toHaveLength(2);
    expect(tiers.b).toHaveLength(3);
    expect(tiers.c).toHaveLength(3);
    expect(tiers.d).toHaveLength(1);
    expect(tiers.s[0].animeId).toBe("anime-0");
  });

  it("keeps locked manual items in manual tiers without changing Elo", () => {
    const tiers = buildTierList(
      [
        { animeId: "auto", eloScore: 2000 },
        {
          animeId: "manual",
          eloScore: 1200,
          manualTier: "s",
          manualRank: 1,
          manualLocked: true
        }
      ],
      DEFAULT_ROWS
    );

    expect(tiers.s.map((item) => item.animeId)).toContain("manual");
    expect(tiers.s.find((item) => item.animeId === "manual")?.eloScore).toBe(1200);
  });

  it("matches manualTier case-insensitively (old uppercase S -> lowercase s)", () => {
    const tiers = buildTierList(
      [
        {
          animeId: "old",
          eloScore: 1000,
          manualTier: "S",
          manualRank: 0,
          manualLocked: true
        }
      ],
      DEFAULT_ROWS
    );

    expect(tiers.s.map((item) => item.animeId)).toContain("old");
  });

  it("falls back to automatic bucketing when manualTier does not match any row", () => {
    const tiers = buildTierList(
      [
        {
          animeId: "unknown",
          eloScore: 2000,
          manualTier: "X",
          manualRank: 0,
          manualLocked: true
        }
      ],
      DEFAULT_ROWS
    );

    expect(tiers.s.map((item) => item.animeId)).toContain("unknown");
  });

  it("uses uniform bucketing for non-5 rows (e.g., 3 rows)", () => {
    const threeRows = [
      { id: "like", label: "Like", color: "#ff747c", order: 0 },
      { id: "meh", label: "Meh", color: "#ffe082", order: 1 },
      { id: "dislike", label: "Dislike", color: "#70f475", order: 2 }
    ];
    const scores = Array.from({ length: 9 }, (_, index) => ({
      animeId: `anime-${index}`,
      eloScore: 2000 - index * 10
    }));
    const tiers = buildTierList(scores, threeRows);

    expect(tiers.like).toHaveLength(3);
    expect(tiers.meh).toHaveLength(3);
    expect(tiers.dislike).toHaveLength(3);
  });

  it("uses uniform bucketing for 6 rows", () => {
    const sixRows = [
      { id: "ss", label: "SS", color: "#ff5252", order: 0 },
      { id: "s", label: "S", color: "#ff747c", order: 1 },
      { id: "a", label: "A", color: "#ffc078", order: 2 },
      { id: "b", label: "B", color: "#ffe082", order: 3 },
      { id: "c", label: "C", color: "#b6ff73", order: 4 },
      { id: "d", label: "D", color: "#70f475", order: 5 }
    ];
    const scores = Array.from({ length: 12 }, (_, index) => ({
      animeId: `anime-${index}`,
      eloScore: 2000 - index * 10
    }));
    const tiers = buildTierList(scores, sixRows);

    expect(tiers.ss).toHaveLength(2);
    expect(tiers.s).toHaveLength(2);
    expect(tiers.a).toHaveLength(2);
    expect(tiers.b).toHaveLength(2);
    expect(tiers.c).toHaveLength(2);
    expect(tiers.d).toHaveLength(2);
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
    expect(() => buildTierList([{ animeId: "", eloScore: 1500 }], DEFAULT_ROWS)).toThrow();
    expect(() => buildTierList([{ animeId: "a", eloScore: Number.NaN }], DEFAULT_ROWS)).toThrow();
  });
});
