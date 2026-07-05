import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("COS cover cache backfill script", () => {
  const source = readFileSync("scripts/cache-covers-to-cos.ts", "utf8");

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
});
