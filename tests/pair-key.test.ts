import { describe, expect, it } from "vitest";
import { makePairKey } from "../src/lib/pair-key";

describe("makePairKey", () => {
  it("returns the same key regardless of argument order", () => {
    expect(makePairKey("anime-b", "anime-a")).toBe("anime-a:anime-b");
    expect(makePairKey("anime-a", "anime-b")).toBe("anime-a:anime-b");
  });

  it("trims ids and rejects empty ids", () => {
    expect(makePairKey(" anime-a ", "anime-b")).toBe("anime-a:anime-b");
    expect(() => makePairKey("", "anime-b")).toThrow();
    expect(() => makePairKey("anime-a", " ")).toThrow();
  });
});
