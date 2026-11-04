import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("music community rank and large-tier display", () => {
  const source = readFileSync("src/components/anisong/SongCommunityRanking.tsx", "utf8");
  it("keeps the original rank after search, not the filtered index", () => {
    expect(source).toContain("overallRank: index + 1");
    expect(source).toContain("{song.overallRank}</span>");
    expect(source).not.toContain("{index + 1}</span><SongCover");
  });
  it("renders Tier entries progressively and preserves absolute tier buckets", () => {
    expect(source).toContain("filteredRows.slice(0, visibleLimit)");
    expect(source).toContain("(song.overallRank - 1) * buckets");
    expect(source).toContain("再显示 30 首");
    expect(source).toContain("搜索不会改变原始档位");
  });
  it("can retry after a community ranking error without a full refresh", () => {
    expect(source).toContain("setRetryKey(value => value + 1)");
    expect(source).toContain("return () => controller.abort()");
  });
});
