import { describe, expect, it, vi } from "vitest";
import { getPairPriority, pickNextPair, type ScoreItem } from "../src/lib/pairing";
import { makePairKey } from "../src/lib/pair-key";

const baseScores: ScoreItem[] = [
  {
    animeId: "a",
    eloScore: 1500,
    uncertainty: 350,
    compareCount: 0,
    tier: "A",
    rank: 1
  },
  {
    animeId: "b",
    eloScore: 1510,
    uncertainty: 320,
    compareCount: 1,
    tier: "A",
    rank: 2
  },
  {
    animeId: "c",
    eloScore: 1900,
    uncertainty: 80,
    compareCount: 40,
    tier: "S",
    rank: 1
  }
];

describe("pairing", () => {
  it("rejects hidden and recent pairs", () => {
    expect(
      getPairPriority({
        a: { ...baseScores[0], isHidden: true },
        b: baseScores[1],
        hasCompared: false,
        isRecentPair: false
      })
    ).toBe(Number.NEGATIVE_INFINITY);

    expect(
      getPairPriority({
        a: baseScores[0],
        b: baseScores[1],
        hasCompared: false,
        isRecentPair: true
      })
    ).toBe(Number.NEGATIVE_INFINITY);
  });

  it("prioritizes close, uncertain, new same-tier pairs", () => {
    const closeNewPair = getPairPriority({
      a: baseScores[0],
      b: baseScores[1],
      hasCompared: false,
      isRecentPair: false
    });
    const farRepeatPair = getPairPriority({
      a: baseScores[0],
      b: baseScores[2],
      hasCompared: true,
      isRecentPair: false
    });

    expect(closeNewPair).toBeGreaterThan(farRepeatPair);
  });

  it("returns null for empty or single-item score lists", () => {
    expect(pickNextPair([], new Set(), new Set())).toBeNull();
    expect(pickNextPair([baseScores[0]], new Set(), new Set())).toBeNull();
  });

  it("picks from eligible top candidates", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const pair = pickNextPair(baseScores, new Set(), new Set());

    expect(pair).not.toBeNull();
    expect(pair?.leftAnimeId).toBe("a");
    expect(pair?.rightAnimeId).toBe("b");
    expect(pair?.reason).toContain("new-pair");

    vi.restoreAllMocks();
  });

  it("skips recent pairs and returns null when no pair is eligible", () => {
    const allPairs = new Set([
      makePairKey("a", "b"),
      makePairKey("a", "c"),
      makePairKey("b", "c")
    ]);

    expect(pickNextPair(baseScores, new Set(), allPairs)).toBeNull();
  });

  it("rejects invalid score input", () => {
    expect(() =>
      getPairPriority({
        a: { ...baseScores[0], eloScore: Number.NaN },
        b: baseScores[1],
        hasCompared: false,
        isRecentPair: false
      })
    ).toThrow();
  });
});
