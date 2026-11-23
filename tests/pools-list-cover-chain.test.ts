import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("/api/pools list cover chain", () => {
  const routeSource = readFileSync("src/app/api/pools/route.ts", "utf8");
  const pageSource = readFileSync("src/app/pools/page.tsx", "utf8");
  const clientApiSource = readFileSync("src/lib/client-api.ts", "utf8");

  it("uses getAnimeCoverUrl with display intent for pool card covers", () => {
    expect(routeSource).toContain('getAnimeCoverUrl(entry.anime, { intent: "display" })');
  });

  it("returns coverImageFallbacks from export intent", () => {
    expect(routeSource).toContain("coverImageFallbacks");
    expect(routeSource).toContain('getAnimeCoverUrl(entry.anime, { intent: "export" })');
  });

  it("coverImageFallbacks uses different intent from primary (display vs export)", () => {
    expect(routeSource).toContain('intent: "display"');
    expect(routeSource).toContain('intent: "export"');
  });

  it("uses getAnimeCoverUrl unified chain, not manual intent-by-intent fallback on raw fields", () => {
    const deriveFn = routeSource.slice(
      routeSource.indexOf("function deriveCoverImages"),
      routeSource.indexOf("function labelForPoolStatus")
    );
    expect(deriveFn).toContain("getAnimeCoverUrl(entry.anime");
    expect(deriveFn).not.toContain(".thumbnailUrl ??");
    expect(deriveFn).not.toContain(".imageUrl ??");
    expect(deriveFn).not.toContain(".imageMediumUrl ??");
    expect(deriveFn).not.toContain(".imageSmallUrl ??");
    expect(deriveFn).not.toContain(".imageLargeUrl ??");
  });

  it("PoolSummary type has coverImageFallbacks field", () => {
    expect(clientApiSource).toContain("coverImageFallbacks");
  });

  it("coverImageFallbacks is typed as (string | null)[]", () => {
    expect(clientApiSource).toContain("coverImageFallbacks?: (string | null)[]");
  });

  it("CoverStrip accepts fallbacks prop and passes to AnimeCover as secondarySrc", () => {
    expect(pageSource).toContain("fallbacks={pool.coverImageFallbacks");
    expect(pageSource).toContain("secondarySrc={fallbacks[index]");
  });

  it("CoverStrip always renders sm size AnimeCover components", () => {
    expect(pageSource).toContain('size="sm"');
  });

  it("falls back to null secondarySrc when fallback index out of range", () => {
    expect(pageSource).toContain("fallbacks[index] ?? null");
  });

  it("deriveCoverImages imports getAnimeCoverUrl from anime-cover-url", () => {
    expect(routeSource).toContain('import { getAnimeCoverUrl } from "@/lib/anime-cover-url"');
  });

  it("serializePoolSummary calls deriveCoverImages and maps to src/secondarySrc", () => {
    expect(routeSource).toContain("deriveCoverImages(pool.poolAnime)");
    expect(routeSource).toContain("coverImages: coverImages.map((image) => image.src)");
    expect(routeSource).toContain("coverImageFallbacks: coverImages.map((image) => image.secondarySrc)");
  });
});
