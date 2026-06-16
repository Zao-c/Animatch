import { describe, it, expect } from "vitest";
import { getAnimeCoverUrl } from "../src/lib/anime-cover-url";
import type { AnimeCoverUrlFields } from "../src/lib/anime-cover-url";

function fakeItem(overrides: Partial<AnimeCoverUrlFields> = {}): AnimeCoverUrlFields {
  return {
    imageUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    thumbnailUrl: null,
    imageSmallUrl: null,
    coverUrl: null,
    posterUrl: null,
    coverUrlOverride: null,
    ...overrides
  };
}

describe("image parity: display vs export intent", () => {
  it("both return imageUrl when available", () => {
    const item = fakeItem({
      imageUrl: "https://img.example.com/cover.jpg",
      imageMediumUrl: "https://img.example.com/medium.jpg",
      thumbnailUrl: "https://img.example.com/thumb.jpg"
    });
    const display = getAnimeCoverUrl(item, { intent: "display" });
    const exportUrl = getAnimeCoverUrl(item, { intent: "export" });
    expect(display).toBe("https://img.example.com/cover.jpg");
    expect(exportUrl).toBe("https://img.example.com/cover.jpg");
    expect(display).toBe(exportUrl);
  });

  it("both fallback to imageMediumUrl when imageUrl is null", () => {
    const item = fakeItem({
      imageUrl: null,
      imageMediumUrl: "https://img.example.com/medium.jpg",
      imageLargeUrl: "https://img.example.com/large.jpg"
    });
    const display = getAnimeCoverUrl(item, { intent: "display" });
    const exportUrl = getAnimeCoverUrl(item, { intent: "export" });
    expect(display).toBe("https://img.example.com/medium.jpg");
    expect(exportUrl).toBe("https://img.example.com/medium.jpg");
    expect(display).toBe(exportUrl);
  });

  it("both fallback to imageLargeUrl when medium is also null", () => {
    const item = fakeItem({
      imageUrl: null,
      imageMediumUrl: null,
      imageLargeUrl: "https://img.example.com/large.jpg"
    });
    const display = getAnimeCoverUrl(item, { intent: "display" });
    const exportUrl = getAnimeCoverUrl(item, { intent: "export" });
    expect(display).toBe("https://img.example.com/large.jpg");
    expect(exportUrl).toBe("https://img.example.com/large.jpg");
    expect(display).toBe(exportUrl);
  });

  it("both respect coverUrlOverride over imageUrl", () => {
    const item = fakeItem({
      imageUrl: "https://img.example.com/cover.jpg",
      coverUrlOverride: "https://img.example.com/override.jpg"
    });
    const display = getAnimeCoverUrl(item, { intent: "display" });
    const exportUrl = getAnimeCoverUrl(item, { intent: "export" });
    expect(display).toBe("https://img.example.com/override.jpg");
    expect(exportUrl).toBe("https://img.example.com/override.jpg");
    expect(display).toBe(exportUrl);
  });

  it("both respect display.isCoverOverridden", () => {
    const item = fakeItem({
      imageUrl: "https://img.example.com/cover.jpg",
      display: {
        coverUrl: "https://img.example.com/display-cover.jpg",
        isCoverOverridden: true
      }
    });
    const display = getAnimeCoverUrl(item, { intent: "display" });
    const exportUrl = getAnimeCoverUrl(item, { intent: "export" });
    expect(display).toBe("https://img.example.com/display-cover.jpg");
    expect(exportUrl).toBe("https://img.example.com/display-cover.jpg");
    expect(display).toBe(exportUrl);
  });

  it("both return null when no URL is available", () => {
    const item = fakeItem();
    const display = getAnimeCoverUrl(item, { intent: "display" });
    const exportUrl = getAnimeCoverUrl(item, { intent: "export" });
    expect(display).toBeNull();
    expect(exportUrl).toBeNull();
  });

  it("both prefer local upload over external URL", () => {
    const item = fakeItem({
      imageUrl: "https://img.example.com/cover.jpg",
      coverUrl: "/uploads/custom-items/user-123/abc.jpg"
    });
    const display = getAnimeCoverUrl(item, { intent: "display" });
    const exportUrl = getAnimeCoverUrl(item, { intent: "export" });
    expect(display).toBe("/uploads/custom-items/user-123/abc.jpg");
    expect(exportUrl).toBe("/uploads/custom-items/user-123/abc.jpg");
    expect(display).toBe(exportUrl);
  });

  it("noisy title TIERMAKER_IMPORT item still gets imageUrl", () => {
    const item = fakeItem({
      imageUrl: "https://tiermaker-images.example.com/real-cover.jpg",
      imageMediumUrl: null,
      imageLargeUrl: null,
      thumbnailUrl: null,
      display: {
        coverUrl: "https://tiermaker-images.example.com/real-cover.jpg",
        isCoverOverridden: false
      }
    });
    const display = getAnimeCoverUrl(item, { intent: "display" });
    const exportUrl = getAnimeCoverUrl(item, { intent: "export" });
    expect(display).toBe("https://tiermaker-images.example.com/real-cover.jpg");
    expect(exportUrl).toBe("https://tiermaker-images.example.com/real-cover.jpg");
    expect(display).toBe(exportUrl);
  });
});
