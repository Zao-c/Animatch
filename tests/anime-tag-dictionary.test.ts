import { describe, expect, it } from "vitest";
import {
  expandTagQuery,
  labelAnimeTag,
  matchTagAliases,
  normalizeTagKey,
} from "../src/lib/anime-tag-dictionary";

describe("anime tag dictionary", () => {
  it("labels common English tags in Chinese", () => {
    expect(labelAnimeTag("romance")).toBe("恋爱");
    expect(labelAnimeTag("school")).toBe("校园");
  });

  it("maps Chinese tag aliases to canonical keys", () => {
    expect(matchTagAliases("爱情")).toBe("romance");
    expect(matchTagAliases("感情线")).toBe("romance");
  });

  it("falls back to the original unknown tag label", () => {
    expect(labelAnimeTag("unknown-tag")).toBe("unknown-tag");
  });

  it("normalizes case, spacing, underscores, and hyphens", () => {
    expect(normalizeTagKey(" Slice-Of_Life ")).toBe("slice of life");
    expect(matchTagAliases("Slice-Of_Life")).toBe("slice of life");
    expect(expandTagQuery("SCI FI")).toContain("sci fi");
  });
});
