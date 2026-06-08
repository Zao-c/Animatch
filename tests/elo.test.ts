import { describe, expect, it } from "vitest";
import {
  expectedScore,
  getKFactor,
  updateElo,
  updateUncertainty
} from "../src/lib/elo";

describe("elo", () => {
  it("calculates expected score symmetrically", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
    expect(expectedScore(1600, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1600, 1500) + expectedScore(1500, 1600)).toBeCloseTo(1);
  });

  it("uses compare count and uncertainty for K factor", () => {
    expect(getKFactor(0, 350)).toBe(56);
    expect(getKFactor(12, 250)).toBe(24);
    expect(getKFactor(40, 50)).toBe(12);
  });

  it("updates Elo without rounding away precision", () => {
    const result = updateElo({
      leftElo: 1500,
      rightElo: 1500,
      leftCompareCount: 0,
      rightCompareCount: 0,
      leftUncertainty: 350,
      rightUncertainty: 350,
      result: "LEFT_WIN"
    });

    expect(result.leftEloAfter).toBeCloseTo(1528);
    expect(result.rightEloAfter).toBeCloseTo(1472);
    expect(result.leftUncertaintyAfter).toBe(329);
    expect(result.rightUncertaintyAfter).toBe(329);
  });

  it("supports draws and minimum uncertainty", () => {
    const result = updateElo({
      leftElo: 1700,
      rightElo: 1300,
      leftCompareCount: 31,
      rightCompareCount: 31,
      leftUncertainty: 80,
      rightUncertainty: 80,
      result: "DRAW"
    });

    expect(result.leftEloAfter).toBeLessThan(1700);
    expect(result.rightEloAfter).toBeGreaterThan(1300);
    expect(updateUncertainty(20)).toBe(80);
  });

  it("rejects invalid numeric input", () => {
    expect(() => expectedScore(Number.NaN, 1500)).toThrow();
    expect(() => getKFactor(0, Number.POSITIVE_INFINITY)).toThrow();
  });
});
