import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/app-error";
import {
  applyManualTierOrdering,
  validateTierPayload
} from "../src/lib/manual-tier-service";

describe("manual tier service pure helpers", () => {
  it("generates manual ranks by tier order", () => {
    expect(
      applyManualTierOrdering([
        { tier: "S", animeIds: ["a", "b"] },
        { tier: "A", animeIds: ["c"] }
      ])
    ).toEqual([
      { animeId: "a", manualTier: "S", manualRank: 0 },
      { animeId: "b", manualTier: "S", manualRank: 1 },
      { animeId: "c", manualTier: "A", manualRank: 0 }
    ]);
  });

  it("throws for duplicate anime ids", () => {
    expect(() =>
      validateTierPayload([
        { tier: "S", animeIds: ["a"] },
        { tier: "A", animeIds: ["a"] }
      ])
    ).toThrow(AppError);
  });

  it("throws for invalid tiers", () => {
    expect(() =>
      validateTierPayload([{ tier: "X" as "S", animeIds: ["a"] }])
    ).toThrow(AppError);
  });
});
