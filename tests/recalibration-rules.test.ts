import { describe, expect, it } from "vitest";
import {
  buildRecalibrationQueue,
  estimateRecalibrationNeed,
  type RecalibrationScore
} from "../src/lib/recalibration-rules";
import { makePairKey } from "../src/lib/pair-key";

const scores: RecalibrationScore[] = [
  { animeId: "a", eloScore: 1500, uncertainty: 300, compareCount: 1, tier: "A", rank: 0 },
  { animeId: "b", eloScore: 1507, uncertainty: 280, compareCount: 2, tier: "A", rank: 1 },
  { animeId: "c", eloScore: 1600, uncertainty: 120, compareCount: 20, tier: "S", rank: 0 },
  { animeId: "d", eloScore: 1495, uncertainty: 320, compareCount: 0, tier: "B", rank: 0 },
  { animeId: "hidden", eloScore: 1501, uncertainty: 350, compareCount: 0, tier: "A", rank: 2, isHidden: true }
];

describe("recalibration rules", () => {
  it("returns empty for empty scores", () => {
    expect(
      buildRecalibrationQueue({
        scores: [],
        comparedPairKeys: new Set(),
        recentPairKeys: new Set(),
        limit: 10
      })
    ).toEqual([]);
  });

  it("excludes hidden and recent pairs", () => {
    const pairs = buildRecalibrationQueue({
      scores,
      comparedPairKeys: new Set(),
      recentPairKeys: new Set([makePairKey("a", "b")]),
      limit: 10
    });

    expect(pairs.some((pair) => pair.leftAnimeId === "hidden" || pair.rightAnimeId === "hidden")).toBe(false);
    expect(pairs.some((pair) => makePairKey(pair.leftAnimeId, pair.rightAnimeId) === makePairKey("a", "b"))).toBe(false);
  });

  it("prioritizes close un-compared low-data pairs", () => {
    const pairs = buildRecalibrationQueue({
      scores,
      comparedPairKeys: new Set([makePairKey("a", "b")]),
      recentPairKeys: new Set(),
      limit: 10
    });

    expect(makePairKey(pairs[0].leftAnimeId, pairs[0].rightAnimeId)).not.toBe(makePairKey("a", "b"));
    expect(pairs[0].priority).toBeGreaterThan(0);
  });

  it("range mode only returns target tier and adjacent tier pairs", () => {
    const pairs = buildRecalibrationQueue({
      scores,
      comparedPairKeys: new Set(),
      recentPairKeys: new Set(),
      limit: 10,
      type: "RANGE",
      targetTier: "A"
    });
    const allowed = new Set(["S", "A", "B"]);

    expect(pairs.length).toBeGreaterThan(0);
    expect(
      pairs.every((pair) => {
        const left = scores.find((score) => score.animeId === pair.leftAnimeId);
        const right = scores.find((score) => score.animeId === pair.rightAnimeId);
        return left !== undefined && right !== undefined && allowed.has(left.tier) && allowed.has(right.tier);
      })
    ).toBe(true);
  });

  it("focus mode prioritizes target anime", () => {
    const pairs = buildRecalibrationQueue({
      scores,
      comparedPairKeys: new Set(),
      recentPairKeys: new Set(),
      limit: 3,
      type: "FOCUS",
      targetAnimeIds: ["c"]
    });

    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((pair) => pair.leftAnimeId === "c" || pair.rightAnimeId === "c")).toBe(true);
  });

  it("estimates recalibration need", () => {
    const need = estimateRecalibrationNeed(scores);

    expect(need.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(need.suggestedCount).toBeGreaterThan(0);
    expect(need.lowDataCount).toBeGreaterThan(0);
  });
});
