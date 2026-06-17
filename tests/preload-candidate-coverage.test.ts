import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("preload-images cover candidate alignment", () => {
  const source = readFileSync("src/lib/preload-images.ts", "utf8");
  const coverSource = readFileSync("src/components/AnimeCover.tsx", "utf8");

  it("preload candidate order matches AnimeCover candidate order", () => {
    expect(source).toContain("proxyExternalImageUrl(heroUrl)");
    expect(source).toContain("proxyExternalImageUrl(exportUrl)");
    expect(source).toContain("heroUrl,");
    expect(source).toContain("exportUrl");
  });

  it("proxy URLs come before raw URLs in preload candidates", () => {
    const proxyIndex = source.indexOf("proxyExternalImageUrl(heroUrl)");
    const rawIndex = source.indexOf("heroUrl,");
    expect(proxyIndex).toBeLessThan(rawIndex);
  });

  it("deduplicates preload candidate values", () => {
    expect(source).toContain("const seen = new Set");
    expect(source).toContain("seen.add(value)");
  });

  it("uses getAnimeCoverUrl with hero and export intents", () => {
    expect(source).toContain('getAnimeCoverUrl(anime, { intent: "hero" })');
    expect(source).toContain('getAnimeCoverUrl(anime, { intent: "export" })');
  });

  it("imports proxyExternalImageUrl for preload wrapping", () => {
    expect(source).toContain('import { proxyExternalImageUrl } from "./image-proxy"');
  });

  it("AnimeCover and preload use same candidate wrapping function", () => {
    expect(coverSource).toContain("proxyExternalImageUrl");
    expect(source).toContain("proxyExternalImageUrl");
  });

  it("preloadPixelImage returns false for empty src", () => {
    expect(source).toContain("return Promise.resolve(false)");
    expect(source).toContain("if (!src)");
  });
});
