import { describe, expect, it } from "vitest";
import { buildScoreDistribution, getAniScore } from "../src/lib/ranking-display";

describe("ranking display scores", () => {
  it("keeps AniScore inside the 1-10 range", () => {
    const distribution = buildScoreDistribution([1200, 1500, 1800]);

    expect(getAniScore(400, distribution).score10).toBeGreaterThanOrEqual(1);
    expect(getAniScore(2600, distribution).score10).toBeLessThanOrEqual(10);
  });

  it("gives higher Elo a higher AniScore", () => {
    const distribution = buildScoreDistribution([1300, 1450, 1500, 1550, 1700]);

    expect(getAniScore(1700, distribution).score10).toBeGreaterThan(
      getAniScore(1300, distribution).score10
    );
  });

  it("does not crash when std is zero", () => {
    const distribution = buildScoreDistribution([1500, 1500, 1500]);

    expect(getAniScore(1500, distribution).label).toBe("5.7 / 10");
  });

  it("handles small samples with a stable fallback", () => {
    const distribution = buildScoreDistribution([1500]);

    expect(getAniScore(1500, distribution).score10).toBe(5.7);
  });

  it("formats the label with one decimal place", () => {
    const distribution = buildScoreDistribution([1400, 1500, 1600]);

    expect(getAniScore(1550, distribution).label).toMatch(/^\d+\.\d \/ 10$/);
  });
});
