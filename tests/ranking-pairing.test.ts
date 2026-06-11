import { describe, expect, it } from "vitest";
import {
  makeUnorderedPairKey,
  pickNextPair,
  scorePairCandidate,
  type ScoreItem
} from "../src/lib/ranking-pairing";

function score(overrides: Partial<ScoreItem> & { animeId: string }): ScoreItem {
  return {
    eloScore: 1500,
    uncertainty: 220,
    compareCount: 4,
    manualLocked: false,
    ...overrides
  };
}

describe("ranking pairing v2", () => {
  it("prioritizes cold-start items", () => {
    const pair = pickNextPair(
      [
        score({ animeId: "cold", compareCount: 0, eloScore: 1500 }),
        score({ animeId: "middle", compareCount: 5, eloScore: 1510 }),
        score({ animeId: "far", compareCount: 6, eloScore: 1850 })
      ],
      new Set(),
      new Set(),
      { stage: "DRAFTING", random: () => 0 }
    );

    expect([pair?.leftAnimeId, pair?.rightAnimeId]).toContain("cold");
  });

  it("avoids recent repeats when another candidate exists", () => {
    const pair = pickNextPair(
      [
        score({ animeId: "a", eloScore: 1500, compareCount: 0 }),
        score({ animeId: "b", eloScore: 1505, compareCount: 0 }),
        score({ animeId: "c", eloScore: 1510, compareCount: 3 })
      ],
      new Set(),
      new Set([makeUnorderedPairKey("a", "b")]),
      { stage: "DRAFTING", random: () => 0 }
    );

    expect(makeUnorderedPairKey(pair?.leftAnimeId ?? "", pair?.rightAnimeId ?? "")).not.toBe(
      makeUnorderedPairKey("a", "b")
    );
  });

  it("prefers closer Elo when exposure is similar", () => {
    const pair = pickNextPair(
      [
        score({ animeId: "a", eloScore: 1500, compareCount: 4 }),
        score({ animeId: "b", eloScore: 1510, compareCount: 4 }),
        score({ animeId: "c", eloScore: 1900, compareCount: 4 })
      ],
      new Set(),
      new Set(),
      { stage: "RELIABLE", random: () => 0 }
    );

    expect(makeUnorderedPairKey(pair?.leftAnimeId ?? "", pair?.rightAnimeId ?? "")).toBe(
      makeUnorderedPairKey("a", "b")
    );
  });

  it("boosts low-exposure items", () => {
    const pair = pickNextPair(
      [
        score({ animeId: "low", compareCount: 2, eloScore: 1500 }),
        score({ animeId: "ready", compareCount: 6, eloScore: 1510 }),
        score({ animeId: "busy", compareCount: 20, eloScore: 1520 })
      ],
      new Set(),
      new Set(),
      { stage: "DRAFT_READY", random: () => 0 }
    );

    expect([pair?.leftAnimeId, pair?.rightAnimeId]).toContain("low");
  });

  it("penalizes manually locked pairs without excluding them", () => {
    const lockedPair = scorePairCandidate({
      a: score({ animeId: "locked-a", eloScore: 1500, manualLocked: true }),
      b: score({ animeId: "locked-b", eloScore: 1505, manualLocked: true }),
      hasCompared: false,
      isRecentPair: false,
      stage: "RELIABLE",
      random: () => 0
    });
    const openPair = scorePairCandidate({
      a: score({ animeId: "open-a", eloScore: 1500 }),
      b: score({ animeId: "open-b", eloScore: 1505 }),
      hasCompared: false,
      isRecentPair: false,
      stage: "RELIABLE",
      random: () => 0
    });

    expect(openPair.total).toBeGreaterThan(lockedPair.total);
    expect(lockedPair.reasons.some((reason) => reason.key === "manual_lock_penalty")).toBe(true);
  });

  it("scores tier-boundary candidates higher in reliable stage", () => {
    const rankedScores = [
      { ...score({ animeId: "near-left", eloScore: 1900 }), rankIndex: 0, percentile: 0.09 },
      { ...score({ animeId: "near-right", eloScore: 1880 }), rankIndex: 1, percentile: 0.11 },
      { ...score({ animeId: "far-left", eloScore: 1500 }), rankIndex: 5, percentile: 0.50 },
      { ...score({ animeId: "far-right", eloScore: 1480 }), rankIndex: 6, percentile: 0.52 }
    ];
    const nearBoundary = scorePairCandidate({
      a: rankedScores[0],
      b: rankedScores[1],
      rankedScores,
      hasCompared: false,
      isRecentPair: false,
      stage: "RELIABLE",
      random: () => 0
    });
    const farBoundary = scorePairCandidate({
      a: rankedScores[2],
      b: rankedScores[3],
      rankedScores,
      hasCompared: false,
      isRecentPair: false,
      stage: "RELIABLE",
      random: () => 0
    });

    expect(nearBoundary.total).toBeGreaterThan(farBoundary.total);
    expect(nearBoundary.reasons.some((reason) => reason.key === "tier_boundary")).toBe(true);
  });

  it("falls back to recent pairs when every pair is recent", () => {
    const pair = pickNextPair(
      [score({ animeId: "a" }), score({ animeId: "b" })],
      new Set([makeUnorderedPairKey("a", "b")]),
      new Set([makeUnorderedPairKey("a", "b")]),
      { stage: "HIGH_CONFIDENCE", random: () => 0 }
    );

    expect(pair).not.toBeNull();
    expect(pair?.reason).toContain("recent_repeat_penalty");
  });

  it("returns null for fewer than two visible items", () => {
    expect(pickNextPair([score({ animeId: "solo" })], new Set(), new Set())).toBeNull();
  });

  it("uses unordered pair keys", () => {
    expect(makeUnorderedPairKey("A", "B")).toBe(makeUnorderedPairKey("B", "A"));
  });
});
