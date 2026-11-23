import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("preload-images cover candidate alignment", () => {
  const source = readFileSync("src/lib/preload-images.ts", "utf8");
  const coverSource = readFileSync("src/components/AnimeCover.tsx", "utf8");

  it("preload candidate order uses the shared proxy-only helper", () => {
    expect(source).toContain("const heroUrl = getAnimeCoverUrl");
    expect(source).toContain("const exportUrl = getAnimeCoverUrl");
    expect(source).toContain("getProxiedCoverCandidates(heroUrl, exportUrl)");
  });

  it("does not maintain a raw remote fallback queue in preload", () => {
    expect(source).not.toContain("const values = [");
    expect(source).not.toContain("proxyExternalImageUrl(heroUrl)");
    expect(source).not.toContain("proxyExternalImageUrl(exportUrl)");
  });

  it("delegates candidate deduplication to the shared helper", () => {
    const imageProxySource = readFileSync("src/lib/image-proxy.ts", "utf8");
    expect(source).toContain("getProxiedCoverCandidates");
    expect(imageProxySource).toContain("const seen = new Set");
    expect(imageProxySource).toContain("seen.add(url)");
  });

  it("uses getAnimeCoverUrl with hero and export intents", () => {
    expect(source).toContain('getAnimeCoverUrl(anime, { intent: "hero" })');
    expect(source).toContain('getAnimeCoverUrl(anime, { intent: "export" })');
  });

  it("imports the shared proxied candidate helper", () => {
    expect(source).toContain('import { getProxiedCoverCandidates } from "./image-proxy"');
  });

  it("AnimeCover and preload use same candidate wrapping function", () => {
    expect(coverSource).toContain("getProxiedCoverCandidates");
    expect(source).toContain("getProxiedCoverCandidates");
  });

  it("preloadPixelImage returns false for empty src", () => {
    expect(source).toContain("return Promise.resolve(false)");
    expect(source).toContain("if (!src)");
  });
});
