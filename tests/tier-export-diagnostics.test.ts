import { describe, it, expect } from "vitest";
import {
  buildTierExportImageSources,
  assertExportImageSources,
  type ExportImageDiagnostic
} from "../src/lib/tier-export-diagnostics";

describe("buildTierExportImageSources", () => {
  it("reports hasImage true for item with imageUrl", () => {
    const results = buildTierExportImageSources([
      {
        animeId: "a1",
        title: "Test Anime",
        titleCn: "测试番",
        source: "BANGUMI",
        imageUrl: "https://img.example.com/cover.jpg",
        imageMediumUrl: null,
        imageLargeUrl: null,
        thumbnailUrl: null,
        imageSmallUrl: null,
        coverUrl: null,
        posterUrl: null
      }
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].animeId).toBe("a1");
    expect(results[0].displayTitle).toBe("测试番");
    expect(results[0].selectedImageUrl).toBe("https://img.example.com/cover.jpg");
    expect(results[0].hasImage).toBe(true);
    expect(results[0].proxiedImageUrl).not.toBeNull();
  });

  it("reports hasImage false for item without any image URL", () => {
    const results = buildTierExportImageSources([
      {
        animeId: "a2",
        title: "No Image",
        titleCn: null,
        source: "MANUAL",
        imageUrl: null,
        imageMediumUrl: null,
        imageLargeUrl: null,
        thumbnailUrl: null,
        imageSmallUrl: null,
        coverUrl: null,
        posterUrl: null
      }
    ]);
    expect(results[0].hasImage).toBe(false);
    expect(results[0].selectedImageUrl).toBeNull();
    expect(results[0].proxiedImageUrl).toBeNull();
  });

  it("noisy TIERMAKER_IMPORT title does not affect selectedImageUrl", () => {
    const results = buildTierExportImageSources([
      {
        animeId: "a3",
        title: "zzzzz177777777777777777777777777777777777777",
        titleCn: null,
        source: "TIERMAKER_IMPORT",
        imageUrl: "https://tiermaker.example.com/real-cover.jpg",
        imageMediumUrl: null,
        imageLargeUrl: null,
        thumbnailUrl: "https://tiermaker.example.com/thumb.jpg",
        imageSmallUrl: null,
        coverUrl: null,
        posterUrl: null
      }
    ]);
    expect(results[0].displayTitle).toBe("未命名作品");
    expect(results[0].selectedImageUrl).toBe("https://tiermaker.example.com/real-cover.jpg");
    expect(results[0].hasImage).toBe(true);
  });

  it("detects coverUrlOverride", () => {
    const results = buildTierExportImageSources([
      {
        animeId: "a4",
        title: "With Override",
        titleCn: null,
        source: "BANGUMI",
        imageUrl: "https://img.example.com/original.jpg",
        coverUrlOverride: "https://img.example.com/override.jpg",
        imageMediumUrl: null,
        imageLargeUrl: null,
        thumbnailUrl: null,
        imageSmallUrl: null,
        coverUrl: null,
        posterUrl: null
      }
    ]);
    expect(results[0].hasOverride).toBe(true);
    expect(results[0].selectedImageUrl).toBe("https://img.example.com/override.jpg");
  });

  it("proxied URL is valid and not double-encoded", () => {
    const results = buildTierExportImageSources([
      {
        animeId: "a5",
        title: "Bangumi Anime",
        titleCn: "番组",
        source: "BANGUMI",
        imageUrl: "https://lain.bgm.tv/pic/cover/l/12/34/5678.jpg",
        imageMediumUrl: null,
        imageLargeUrl: null,
        thumbnailUrl: null,
        imageSmallUrl: null,
        coverUrl: null,
        posterUrl: null
      }
    ]);
    const proxied = results[0].proxiedImageUrl;
    expect(proxied).not.toBeNull();
    expect(proxied).not.toContain("undefined");
    expect(proxied).not.toContain("null");
    expect(proxied?.startsWith("/api/image-proxy?url=")).toBe(true);
    expect(proxied).not.toContain("%2Fapi%2Fimage-proxy");
  });

  it("relative paths are not proxied", () => {
    const results = buildTierExportImageSources([
      {
        animeId: "a6",
        title: "Local Upload",
        titleCn: null,
        source: "CUSTOM_UPLOAD",
        imageUrl: null,
        imageMediumUrl: null,
        imageLargeUrl: null,
        thumbnailUrl: null,
        imageSmallUrl: null,
        coverUrl: "/uploads/anime-covers/cover.jpg",
        posterUrl: null
      }
    ]);
    expect(results[0].selectedImageUrl).toBe("/uploads/anime-covers/cover.jpg");
    expect(results[0].proxiedImageUrl).toBe("/uploads/anime-covers/cover.jpg");
    expect(results[0].selectedUrlIsLocal).toBe(true);
  });

  it("reports fitMode contain for TIERMAKER_IMPORT", () => {
    const results = buildTierExportImageSources([
      {
        animeId: "a7",
        title: "TM Item",
        titleCn: null,
        source: "TIERMAKER_IMPORT",
        imageUrl: "https://example.com/img.jpg",
        imageMediumUrl: null,
        imageLargeUrl: null,
        thumbnailUrl: null,
        imageSmallUrl: null,
        coverUrl: null,
        posterUrl: null
      }
    ]);
    expect(results[0].fitMode).toBe("contain");
  });
});

describe("assertExportImageSources", () => {
  it("detects double-proxied URLs", () => {
    const diags: ExportImageDiagnostic[] = [
      {
        animeId: "x1",
        displayTitle: "Test",
        rawTitle: "Test",
        sourceType: "BANGUMI",
        hasOverride: false,
        selectedImageUrl: "https://example.com/img.jpg",
        selectedUrlIsLocal: false,
        proxiedImageUrl: "/api/image-proxy?url=%2Fapi%2Fimage-proxy%3Furl%3Dhttps%3A%2F%2Fexample.com",
        hasImage: true,
        fitMode: "cover"
      }
    ];
    const { errors } = assertExportImageSources(diags);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toContain("double-proxied");
  });

  it("warns when item has no image", () => {
    const diags: ExportImageDiagnostic[] = [
      {
        animeId: "x2",
        displayTitle: "No Image",
        rawTitle: "No Image",
        sourceType: "MANUAL",
        hasOverride: false,
        selectedImageUrl: null,
        selectedUrlIsLocal: false,
        proxiedImageUrl: null,
        hasImage: false,
        fitMode: "cover"
      }
    ];
    const { warnings } = assertExportImageSources(diags);
    expect(warnings.some((w) => w.includes("no image URL"))).toBe(true);
  });

  it("reports zero errors for clean items", () => {
    const diags: ExportImageDiagnostic[] = [
      {
        animeId: "x3",
        displayTitle: "Clean Item",
        rawTitle: "Clean Item",
        sourceType: "BANGUMI",
        hasOverride: false,
        selectedImageUrl: "https://example.com/img.jpg",
        selectedUrlIsLocal: false,
        proxiedImageUrl: "/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimg.jpg",
        hasImage: true,
        fitMode: "cover"
      }
    ];
    const { errors, warnings } = assertExportImageSources(diags);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
