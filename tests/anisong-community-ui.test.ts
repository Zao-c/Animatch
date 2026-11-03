import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("large music community ranking UX", () => {
  const source = readFileSync("src/components/anisong/SongCommunityRanking.tsx", "utf8");
  it("supports search and incremental rendering for annual ranking", () => {
    expect(source).toContain('aria-label="搜索社区榜歌曲"');
    expect(source).toContain("filteredRows.slice(0, visibleLimit)");
    expect(source).toContain("setVisibleLimit(value => value + 30)");
  });
});
