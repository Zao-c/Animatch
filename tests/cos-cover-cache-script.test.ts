import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("COS cover cache backfill script", () => {
  const source = readFileSync("scripts/cache-covers-to-cos.ts", "utf8");
  const serviceSource = readFileSync("src/lib/server/cos-cover-cache.ts", "utf8");
  const poolServiceSource = readFileSync("src/lib/server/pool-cover-cache.ts", "utf8");

  it("selects stale cached covers when the source image URL changes", () => {
    expect(source).toContain("anime.cachedCoverSourceUrl !== sourceUrl");
    expect(source).toContain('reason: "stale-source"');
    expect(source).toContain("usedStaleAnimeCount");
  });

  it("scans active pool anime before applying the upload limit", () => {
    expect(source).toContain("const scanLimit = args.allLibrary ? Math.max(args.limit * 10, args.limit) : undefined");
    expect(source).toContain(".filter(({ state }) => args.force || state.needsCache)");
    expect(source).toContain(".slice(0, args.limit)");
  });

  it("does not silently drop COS background queue overflow", () => {
    expect(serviceSource).toContain("export type CosCoverBackgroundQueueResult");
    expect(serviceSource).toContain('return "overflow"');
    expect(serviceSource).toContain('console.warn("[COS cover cache] queue overflow"');
    expect(serviceSource).toContain("MAX_BACKGROUND_QUEUE = 2000");
    expect(serviceSource).toContain("droppedCount");
  });

  it("reports pool batch cover cache overflow in server logs", () => {
    expect(poolServiceSource).toContain("const cosSummary = cacheAnimeCoversToCosBackground(validAnimes)");
    expect(poolServiceSource).toContain("cosSummary.overflow > 0");
    expect(poolServiceSource).toContain('console.warn("[pool cover cache] COS queue overflow in batch"');
  });
});
