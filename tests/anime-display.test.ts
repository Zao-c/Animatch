import { describe, expect, it } from "vitest";
import {
  getAnimeDisplaySubtitle,
  getAnimeDisplayTitle,
  getEffectiveAnimeDisplay,
  isGeneratedOrNoisyTitle,
  shouldUseContainCover,
  type PoolAnimeDisplayFields,
  UNNAMED_ANIME_TITLE
} from "../src/lib/anime-display";

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

  it("labels TIERMAKER_IMPORT as TierMaker", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        anime: {
          ...entry().anime,
          source: "TIERMAKER_IMPORT"
        }
      })
    );

    expect(display.sourceLabel).toBe("TierMaker");
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

  it("hides noisy generated TierMaker titles", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        anime: {
          ...entry().anime,
          source: "TIERMAKER_IMPORT",
          title: "zzzzz 17750273769085f154 f2a3b4c5d6e7f8",
          titleCn: null
        }
      })
    );

    expect(display.title).toBe(UNNAMED_ANIME_TITLE);
    expect(display.subtitle).toBeNull();
  });
});

describe("anime display helpers", () => {
  it("hides noisy generated TierMaker titles without changing normal titles", () => {
    const noisy = "zzzzz 17750273769085f154 f2a3b4c5d6e7f8";

    expect(isGeneratedOrNoisyTitle(noisy)).toBe(true);
    expect(
      getAnimeDisplayTitle({
        source: "TIERMAKER_IMPORT",
        title: noisy
      })
    ).toBe(UNNAMED_ANIME_TITLE);
    expect(
      getAnimeDisplayTitle({
        source: "BANGUMI",
        title: "Bocchi the Rock!",
        titleCn: "孤独摇滚！"
      })
    ).toBe("孤独摇滚！");
    expect(
      getAnimeDisplayTitle({
        source: "TIERMAKER_IMPORT",
        title: "Miku"
      })
    ).toBe("Miku");
  });

  it("keeps user image sources on the contain cover strategy", () => {
    expect(shouldUseContainCover({ source: "TIERMAKER_IMPORT" })).toBe(true);
    expect(shouldUseContainCover({ source: "CUSTOM_UPLOAD" })).toBe(true);
    expect(shouldUseContainCover({ source: "BANGUMI" })).toBe(false);
  });

  it("does not repeat noisy titles as subtitles", () => {
    expect(
      getAnimeDisplaySubtitle({
        source: "TIERMAKER_IMPORT",
        title: "https://tiermaker.com/images/12345678901234567890.png"
      })
    ).toBeNull();
  });

  it("replaces noisy CUSTOM_UPLOAD title with UNNAMED_ANIME_TITLE", () => {
    expect(
      getAnimeDisplayTitle({
        source: "CUSTOM_UPLOAD",
        title: "zzzzz177777777777777777777777777777777777777"
      })
    ).toBe(UNNAMED_ANIME_TITLE);
  });

  it("keeps clean CUSTOM_UPLOAD title intact", () => {
    expect(
      getAnimeDisplayTitle({
        source: "CUSTOM_UPLOAD",
        title: "My Favorite Anime"
      })
    ).toBe("My Favorite Anime");
  });

  it("replaces noisy TIERMAKER_IMPORT title with UNNAMED_ANIME_TITLE in effective display", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        anime: {
          title: "aaaaaaaa177777777777777",
          titleCn: null,
          titleJa: null,
          titleEn: null,
          imageUrl: "https://example.com/x.jpg",
          thumbnailUrl: "https://example.com/x.jpg",
          animeType: "TV",
          tags: [],
          source: "TIERMAKER_IMPORT"
        }
      })
    );
    expect(display.title).toBe(UNNAMED_ANIME_TITLE);
  });

  it("replaces noisy CUSTOM_UPLOAD title with UNNAMED_ANIME_TITLE in effective display", () => {
    const display = getEffectiveAnimeDisplay(
      entry({
        anime: {
          title: "zzzzz177777777777777777777777777777777777777",
          titleCn: null,
          titleJa: null,
          titleEn: null,
          imageUrl: "https://example.com/y.jpg",
          thumbnailUrl: "https://example.com/y.jpg",
          animeType: "TV",
          tags: [],
          source: "CUSTOM_UPLOAD"
        }
      })
    );
    expect(display.title).toBe(UNNAMED_ANIME_TITLE);
  });
});
