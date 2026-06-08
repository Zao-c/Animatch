import { PoolComparisonResult } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  getSeenState,
  getWinnerLoser,
  isEffectiveResult,
  shouldHideAfterUnseen
} from "../src/lib/match-rules";
import { pickNextPair, type ScoreItem } from "../src/lib/pairing";
import { makePairKey } from "../src/lib/pair-key";

describe("match rules", () => {
  it("identifies Elo-effective results", () => {
    expect(isEffectiveResult(PoolComparisonResult.LEFT_WIN)).toBe(true);
    expect(isEffectiveResult(PoolComparisonResult.RIGHT_WIN)).toBe(true);
    expect(isEffectiveResult(PoolComparisonResult.DRAW)).toBe(true);
    expect(isEffectiveResult(PoolComparisonResult.SKIP)).toBe(false);
    expect(isEffectiveResult(PoolComparisonResult.LEFT_UNSEEN)).toBe(false);
    expect(isEffectiveResult(PoolComparisonResult.BOTH_UNSEEN)).toBe(false);
  });

  it("recalibration mode still uses result to decide Elo effectiveness", () => {
    expect(isEffectiveResult(PoolComparisonResult.LEFT_WIN)).toBe(true);
    expect(isEffectiveResult(PoolComparisonResult.SKIP)).toBe(false);
  });

  it("maps winner and loser only for decisive results", () => {
    expect(getWinnerLoser(PoolComparisonResult.LEFT_WIN, "left", "right")).toEqual({
      winnerAnimeId: "left",
      loserAnimeId: "right"
    });
    expect(getWinnerLoser(PoolComparisonResult.RIGHT_WIN, "left", "right")).toEqual({
      winnerAnimeId: "right",
      loserAnimeId: "left"
    });
    expect(getWinnerLoser(PoolComparisonResult.DRAW, "left", "right")).toEqual({
      winnerAnimeId: null,
      loserAnimeId: null
    });
  });

  it("maps seen state for skip and unseen results without implying Elo updates", () => {
    expect(getSeenState(PoolComparisonResult.SKIP)).toEqual({
      leftSeen: null,
      rightSeen: null
    });
    expect(getSeenState(PoolComparisonResult.LEFT_UNSEEN)).toEqual({
      leftSeen: false,
      rightSeen: true
    });
    expect(getSeenState(PoolComparisonResult.BOTH_UNSEEN)).toEqual({
      leftSeen: false,
      rightSeen: false
    });
  });

  it("hides after repeated unseen marks", () => {
    expect(shouldHideAfterUnseen(1)).toBe(false);
    expect(shouldHideAfterUnseen(2)).toBe(true);
  });

  it("can build a queue without repeating pair keys", () => {
    const scores: ScoreItem[] = [
      { animeId: "a", eloScore: 1500, uncertainty: 350, compareCount: 0 },
      { animeId: "b", eloScore: 1505, uncertainty: 350, compareCount: 0 },
      { animeId: "c", eloScore: 1510, uncertainty: 350, compareCount: 0 }
    ];
    const queuedKeys = new Set<string>();
    const first = pickNextPair(scores, new Set(), queuedKeys);

    expect(first).not.toBeNull();

    if (first !== null) {
      queuedKeys.add(makePairKey(first.leftAnimeId, first.rightAnimeId));
    }

    const second = pickNextPair(scores, new Set(), queuedKeys);

    expect(second).not.toBeNull();

    if (first !== null && second !== null) {
      expect(makePairKey(second.leftAnimeId, second.rightAnimeId)).not.toBe(
        makePairKey(first.leftAnimeId, first.rightAnimeId)
      );
    }
  });
});
