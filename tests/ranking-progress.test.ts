import { describe, expect, it } from "vitest";
import { buildRankingProgress, countEffectiveComparisons } from "../src/lib/ranking-progress";

describe("ranking progress", () => {
  it("calculates targets for 10 items", () => {
    const progress = buildRankingProgress({
      totalItems: 10,
      effectiveComparisons: 0
    });

    expect(progress.draftTarget).toBe(15);
    expect(progress.reliableTarget).toBe(30);
    expect(progress.highConfidenceTarget).toBe(50);
  });

  it("does not count SKIP or UNSEEN as effective comparisons", () => {
    expect(
      countEffectiveComparisons([
        "LEFT_WIN",
        "RIGHT_WIN",
        "DRAW",
        "SKIP",
        "LEFT_UNSEEN",
        "RIGHT_UNSEEN",
        "BOTH_UNSEEN"
      ])
    ).toBe(3);
  });

  it("detects ranking stages", () => {
    expect(buildRankingProgress({ totalItems: 10, effectiveComparisons: 0 }).stage).toBe(
      "DRAFTING"
    );
    expect(buildRankingProgress({ totalItems: 10, effectiveComparisons: 15 }).stage).toBe(
      "DRAFT_READY"
    );
    expect(buildRankingProgress({ totalItems: 10, effectiveComparisons: 30 }).stage).toBe(
      "RELIABLE"
    );
    expect(buildRankingProgress({ totalItems: 10, effectiveComparisons: 50 }).stage).toBe(
      "HIGH_CONFIDENCE"
    );
  });

  it("calculates remaining comparisons to the next stage", () => {
    expect(
      buildRankingProgress({ totalItems: 10, effectiveComparisons: 12 })
        .remainingToNextStage
    ).toBe(3);
    expect(
      buildRankingProgress({ totalItems: 10, effectiveComparisons: 15 })
        .remainingToNextStage
    ).toBe(15);
  });

  it("returns EMPTY when totalItems is less than 2", () => {
    const progress = buildRankingProgress({
      totalItems: 1,
      effectiveComparisons: 0
    });

    expect(progress.stage).toBe("EMPTY");
    expect(progress.stageLabel).toBe("作品不足");
  });
});
