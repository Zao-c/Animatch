import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeDiscoveryPanel } from "../src/components/AnimeDiscoveryPanel";
import { bangumiSearchItemToAnime, parseBangumiReference, validateDiscoveryYears } from "../src/lib/anime-discovery";

describe("anime discovery", () => {
  it("accepts only numeric IDs or official subject references", () => {
    expect(parseBangumiReference("https://bgm.tv/subject/876?from=test")).toBe(876);
    expect(parseBangumiReference("https://bangumi.tv/subject/876/")).toBe(876);
    expect(parseBangumiReference(" 876 ")).toBe(876);
    for (const value of ["https://evil.test/subject/876", "https://bgm.tv.evil.test/subject/876", "-1", "0", "99999999999999999999", "动画2026"]) expect(parseBangumiReference(value)).toBeNull();
  });
  it("rejects inverted or malformed years instead of silently returning no results", () => {
    expect(validateDiscoveryYears({ yearFrom: "2027", yearTo: "2026" })).toBeTruthy();
    expect(validateDiscoveryYears({ yearFrom: "oops", yearTo: "" })).toBeTruthy();
    expect(validateDiscoveryYears({ yearFrom: "2026.5", yearTo: "" })).toBeTruthy();
    expect(validateDiscoveryYears({ yearFrom: "2026", yearTo: "2026" })).toBeNull();
    expect(validateDiscoveryYears({ yearFrom: "", yearTo: "" })).toBeNull();
  });
  it("keeps all cover sizes and metadata when converting a search result", () => {
    const anime = bangumiSearchItemToAnime({ bangumiId: 876, sourceId: "876", title: "Example", titleCn: null, imageUrl: "https://lain.bgm.tv/common.jpg", imageSmallUrl: "https://lain.bgm.tv/small.jpg", imageMediumUrl: "https://lain.bgm.tv/medium.jpg", imageLargeUrl: "https://lain.bgm.tv/large.jpg", sourceUrl: "https://bgm.tv/subject/876", summary: null, tags: [], airDate: "2026-01-01", year: 2026, bangumiScore: 8.5 });
    expect(anime).toMatchObject({ bgmId: 876, bangumiScore: 8.5, year: 2026, imageLargeUrl: "https://lain.bgm.tv/large.jpg", imageMediumUrl: "https://lain.bgm.tv/medium.jpg", imageSmallUrl: "https://lain.bgm.tv/small.jpg" });
  });
  it("renders an accessible source picker, named filters and a single search area", () => {
    const html = renderToStaticMarkup(React.createElement(AnimeDiscoveryPanel, { poolId: "test", joinedAnimeIds: new Set<string>(), joinedBangumiIds: new Set<number>(), onAdded: async () => {} }));
    expect(html).toContain('aria-label="作品数据来源"');
    expect(html).toContain("Bangumi 在线");
    expect(html).toContain("本地动画库");
    expect(html).toContain('aria-label="搜索作品"');
    expect(html).toContain('aria-label="开始年份"');
    expect(html).toContain('aria-label="作品排序"');
    expect(html).not.toContain("更多导入方式");
  });
});
