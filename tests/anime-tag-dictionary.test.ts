import { describe, expect, it } from "vitest";
import {
  expandTagQuery,
  labelAnimeTag,
  matchTagAliases,
  normalizeTagKey,
  suggestAnimeTags,
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

  it("suggests popular tags for empty input", () => {
    const suggestions = suggestAnimeTags("", 3);

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0].label).toBe("恋爱");
  });

  it("suggests tags from labels, aliases, and English keys", () => {
    expect(suggestAnimeTags("恋")[0].label).toBe("恋爱");
    expect(suggestAnimeTags("爱情")[0].label).toBe("恋爱");
    expect(suggestAnimeTags("romance")[0].label).toBe("恋爱");
    expect(suggestAnimeTags("school")[0].label).toBe("校园");
    expect(suggestAnimeTags("热").map((tag) => tag.label)).toContain("热血");
  });

  it("returns no suggestions for unknown input", () => {
    expect(suggestAnimeTags("not-a-real-tag")).toEqual([]);
  });

  it("deduplicates suggestions and sorts them by weight", () => {
    const suggestions = suggestAnimeTags("题材", 10);
    const keys = suggestions.map((tag) => tag.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(suggestions[0].weight).toBeGreaterThanOrEqual(suggestions[1].weight);
  });
});
