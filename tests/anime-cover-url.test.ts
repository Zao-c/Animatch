import { describe, expect, it } from "vitest";
import { getAnimeCoverUrl, type AnimeCoverUrlFields } from "../src/lib/anime-cover-url";

function coverFields(overrides: Partial<AnimeCoverUrlFields> = {}): AnimeCoverUrlFields {
  return {
    imageUrl: "https://example.com/high.jpg",
    imageMediumUrl: "https://example.com/medium.jpg",
    imageSmallUrl: "https://example.com/small.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
    coverUrl: "https://example.com/thumb.jpg",
    ...overrides
  };
}

describe("getAnimeCoverUrl", () => {
  it("prefers thumbnailUrl for thumbnail intent", () => {
    expect(getAnimeCoverUrl(coverFields(), { intent: "thumbnail" })).toBe(
      "https://example.com/thumb.jpg"
    );
  });

  it("prefers imageUrl for hero intent", () => {
    expect(getAnimeCoverUrl(coverFields(), { intent: "hero" })).toBe(
      "https://example.com/high.jpg"
    );
  });

  it("prefers cover overrides over intent-specific images", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          coverUrlOverride: "https://example.com/override.jpg"
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/override.jpg");
  });

  it("prefers overridden display covers over intent-specific images", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          display: {
            coverUrl: "https://example.com/display-override.jpg",
            isCoverOverridden: true
          }
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/display-override.jpg");
  });

  it("does not let non-overridden display covers force thumbnails in hero intent", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          display: {
            coverUrl: "https://example.com/thumb.jpg",
            isCoverOverridden: false
          }
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/high.jpg");
  });

  it("keeps local custom upload paths ahead of lower priority fields", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageUrl: "/uploads/custom-items/test.png",
          thumbnailUrl: "https://example.com/thumb.jpg",
          coverUrl: "https://example.com/thumb.jpg"
        }),
        { intent: "thumbnail" }
      )
    ).toBe("/uploads/custom-items/test.png");
  });

  it("prefers imageUrl over large remote variants for export intent", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageLargeUrl: "https://example.com/large.jpg",
          imageUrl: "https://example.com/high.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg",
          coverUrl: "https://example.com/thumb.jpg"
        }),
        { intent: "export" }
      )
    ).toBe("https://example.com/high.jpg");
  });

  it("keeps cover overrides above export images", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          coverUrlOverride: "https://example.com/override.jpg",
          imageLargeUrl: "https://example.com/large.jpg"
        }),
        { intent: "export" }
      )
    ).toBe("https://example.com/override.jpg");
  });

  it("uses poster and cover fields before lower priority export variants", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageUrl: null,
          posterUrl: "https://example.com/poster.jpg",
          coverUrl: "https://example.com/cover.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg",
          imageLargeUrl: "https://example.com/large.jpg"
        }),
        { intent: "export" }
      )
    ).toBe("https://example.com/poster.jpg");

    expect(
      getAnimeCoverUrl(
        coverFields({
          imageUrl: null,
          posterUrl: null,
          coverUrl: "https://example.com/cover.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg",
          imageLargeUrl: "https://example.com/large.jpg"
        }),
        { intent: "export" }
      )
    ).toBe("https://example.com/cover.jpg");
  });
});
