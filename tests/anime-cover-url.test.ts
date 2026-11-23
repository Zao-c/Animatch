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

  it("prefers imageLargeUrl over imageUrl for hero intent", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageLargeUrl: "https://example.com/large.jpg",
          imageUrl: "https://example.com/high.jpg"
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/large.jpg");
  });

  it("prefers imageLargeUrl over imageUrl for display intent", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageLargeUrl: "https://example.com/large.jpg",
          imageUrl: "https://example.com/high.jpg"
        }),
        { intent: "display" }
      )
    ).toBe("https://example.com/large.jpg");
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
          imageLargeUrl: "https://example.com/large.jpg",
          display: {
            coverUrl: "https://example.com/thumb.jpg",
            isCoverOverridden: false
          }
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/large.jpg");
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

  it("demotes local SVG to fallback after remote URLs", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageLargeUrl: "https://example.com/large.jpg",
          imageUrl: "https://example.com/high.jpg",
          thumbnailUrl: "/demo-covers/test.svg",
          display: {
            coverUrl: "/brand/fallback.svg",
            isCoverOverridden: false
          }
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/large.jpg");
  });

  it("falls back to local SVG when no remote URL is available", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageUrl: null,
          imageMediumUrl: null,
          imageLargeUrl: null,
          thumbnailUrl: null,
          imageSmallUrl: null,
          coverUrl: null,
          display: {
            coverUrl: "/demo-covers/hyouka.svg",
            isCoverOverridden: false
          }
        }),
        { intent: "hero" }
      )
    ).toBe("/demo-covers/hyouka.svg");
  });

  it("remote SVG is NOT demoted (treated like a remote URL)", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageLargeUrl: null,
          imageMediumUrl: null,
          imageUrl: "https://example.com/remote.svg",
          thumbnailUrl: "/demo-covers/local.svg",
          coverUrl: null
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/remote.svg");
  });

  it("coverUrlOverride still highest even when SVG", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          coverUrlOverride: "/demo-covers/hyouka.svg",
          imageLargeUrl: "https://example.com/large.jpg"
        }),
        { intent: "hero" }
      )
    ).toBe("/demo-covers/hyouka.svg");
  });

  it("prefers imageLargeUrl for export intent over imageUrl", () => {
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
    ).toBe("https://example.com/large.jpg");
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

  it("export and display produce the same fallback chain for non-poster fields", () => {
    const fields = coverFields({
      imageUrl: null,
      posterUrl: "https://example.com/poster.jpg",
      coverUrl: "https://example.com/cover.jpg",
      thumbnailUrl: "https://example.com/thumb.jpg",
      imageLargeUrl: "https://example.com/large.jpg"
    });
    expect(getAnimeCoverUrl(fields, { intent: "export" }))
      .toBe(getAnimeCoverUrl(fields, { intent: "display" }));
  });

  it("export falls back to posterUrl after all other fields are exhausted", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageUrl: null,
          imageMediumUrl: null,
          imageLargeUrl: null,
          thumbnailUrl: null,
          imageSmallUrl: null,
          coverUrl: null,
          posterUrl: "https://example.com/poster.jpg"
        }),
        { intent: "export" }
      )
    ).toBe("https://example.com/poster.jpg");

    expect(
      getAnimeCoverUrl(
        coverFields({
          imageUrl: null,
          imageMediumUrl: null,
          imageLargeUrl: null,
          thumbnailUrl: null,
          imageSmallUrl: null,
          coverUrl: null,
          posterUrl: null
        }),
        { intent: "export" }
      )
    ).toBeNull();
  });

  it("imageSmallUrl has higher priority than thumbnailUrl in hero intent", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageLargeUrl: null,
          imageMediumUrl: null,
          imageUrl: null,
          imageSmallUrl: "https://example.com/small.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg"
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/small.jpg");
  });

  it("thumbnail has lowest priority among remote images for hero intent", () => {
    expect(
      getAnimeCoverUrl(
        coverFields({
          imageLargeUrl: null,
          imageMediumUrl: null,
          imageUrl: null,
          imageSmallUrl: null,
          thumbnailUrl: "https://example.com/thumb.jpg",
          coverUrl: null,
          display: {
            coverUrl: "/demo-covers/test.svg",
            isCoverOverridden: false
          }
        }),
        { intent: "hero" }
      )
    ).toBe("https://example.com/thumb.jpg");
  });
});
