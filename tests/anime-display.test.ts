import { describe, expect, it } from "vitest";
import { getEffectiveAnimeDisplay, type PoolAnimeDisplayFields } from "../src/lib/anime-display";

function entry(overrides: Partial<PoolAnimeDisplayFields> = {}): PoolAnimeDisplayFields {
  return {
    displayTitleOverride: null,
    coverUrlOverride: null,
    animeTypeOverride: null,
    tagsOverride: [],
    overrideNote: null,
    anime: {
      title: "Original Title",
      titleCn: "中文标题",
      titleJa: "日本語タイトル",
      titleEn: "English Title",
      imageUrl: "https://example.com/original.jpg",
      thumbnailUrl: "https://example.com/thumb.jpg",
      animeType: "TV",
      tags: ["action", "fantasy"],
      source: "MANAMI"
    },
    ...overrides
  };
}

describe("getEffectiveAnimeDisplay", () => {
  it("prefers override title over anime titles", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        displayTitleOverride: "手动标题"
      })
    );

    expect(display.title).toBe("手动标题");
    expect(display.subtitle).toBe("Original Title");
    expect(display.isOverridden).toBe(true);
  });

  it("prefers override cover over thumbnail and image", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        coverUrlOverride: "https://example.com/override.jpg"
      })
    );

    expect(display.coverUrl).toBe("https://example.com/override.jpg");
    expect(display.isOverridden).toBe(true);
    expect(display.isCoverOverridden).toBe(true);
  });

  it("uses local uploaded cover overrides", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        coverUrlOverride: "/uploads/anime-covers/pool-1-anime-1-cover.webp"
      })
    );

    expect(display.coverUrl).toBe("/uploads/anime-covers/pool-1-anime-1-cover.webp");
    expect(display.isOverridden).toBe(true);
    expect(display.isCoverOverridden).toBe(true);
  });

  it("uses CUSTOM_UPLOAD imageUrl as display cover", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        anime: {
          ...entry().anime,
          source: "CUSTOM_UPLOAD",
          thumbnailUrl: null,
          imageUrl: "/uploads/custom-items/test.png"
        }
      })
    );

    expect(display.coverUrl).toBe("/uploads/custom-items/test.png");
  });

  it("prefers non-empty tagsOverride over anime tags", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        tagsOverride: ["动作", "热血"]
      })
    );

    expect(display.tags).toEqual(["动作", "热血"]);
  });

  it("falls back to anime fields when no overrides exist", () => {
    const display = getEffectiveAnimeDisplay(entry());

    expect(display.title).toBe("中文标题");
    expect(display.coverUrl).toBe("https://example.com/thumb.jpg");
    expect(display.animeType).toBe("TV");
    expect(display.tags).toEqual(["action", "fantasy"]);
    expect(display.isOverridden).toBe(false);
    expect(display.isCoverOverridden).toBe(false);
  });
});
