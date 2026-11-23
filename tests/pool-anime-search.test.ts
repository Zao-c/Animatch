import { describe, expect, it } from "vitest";
import {
  getPoolAnimeSearchText,
  isSuspiciousPoolAnimeTitle,
  matchesPoolAnimeSearch
} from "../src/lib/pool-anime-search";
import type { PoolAnimeEntry, PublicAnime } from "../src/lib/client-api";

const EMPTY_DISPLAY: PoolAnimeEntry["display"] = {
  title: "",
  subtitle: null,
  coverUrl: null,
  animeType: null,
  tags: [],
  sourceLabel: "",
  isOverridden: false,
  isCoverOverridden: false
};

function makeAnime(overrides: Partial<PublicAnime> = {}): PublicAnime {
  return {
    id: "anime-1",
    bgmId: null,
    title: "Original Title",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    imageUrl: "https://example.com/a.jpg",
    imageSmallUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    coverUrl: null,
    thumbnailUrl: null,
    bangumiRank: null,
    bangumiScore: null,
    tags: [],
    aliases: [],
    year: null,
    season: null,
    animeType: "TV",
    studios: [],
    source: "MANAMI",
    ...overrides
  };
}

function makeEntry(overrides: Partial<PoolAnimeEntry> = {}): PoolAnimeEntry {
  return {
    id: "entry-1",
    poolId: "pool-1",
    animeId: "anime-1",
    position: 1,
    note: null,
    initialElo: 1500,
    displayTitleOverride: null,
    coverUrlOverride: null,
    animeTypeOverride: null,
    tagsOverride: [],
    overrideNote: null,
    overrideUpdatedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    anime: makeAnime(),
    display: EMPTY_DISPLAY,
    ...overrides
  };
}

describe("matchesPoolAnimeSearch", () => {
  it("matches the Chinese title", () => {
    const entry = makeEntry({ anime: makeAnime({ title: "Shingeki no Kyojin", titleCn: "进击的巨人" }) });

    expect(matchesPoolAnimeSearch(entry, "进击")).toBe(true);
    expect(matchesPoolAnimeSearch(entry, "巨人")).toBe(true);
  });

  it("matches the original title case-insensitively", () => {
    const entry = makeEntry({ anime: makeAnime({ title: "Cowboy Bebop" }) });

    expect(matchesPoolAnimeSearch(entry, "cowboy")).toBe(true);
    expect(matchesPoolAnimeSearch(entry, "BEBOP")).toBe(true);
  });

  it("matches aliases", () => {
    const entry = makeEntry({ anime: makeAnime({ title: "Shingeki no Kyojin", aliases: ["AoT", "Attack on Titan"] }) });

    expect(matchesPoolAnimeSearch(entry, "aot")).toBe(true);
    expect(matchesPoolAnimeSearch(entry, "attack on titan")).toBe(true);
  });

  it("returns true for an empty query", () => {
    const entry = makeEntry();
    expect(matchesPoolAnimeSearch(entry, "")).toBe(true);
    expect(matchesPoolAnimeSearch(entry, "   ")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    const entry = makeEntry({ anime: makeAnime({ title: "Cowboy Bebop" }) });
    expect(matchesPoolAnimeSearch(entry, "naruto")).toBe(false);
  });
});

describe("renamed works (displayTitleOverride)", () => {
  it("is findable by the edited title and by the original title", () => {
    const entry = makeEntry({
      displayTitleOverride: "我的新标题",
      anime: makeAnime({ title: "Original Title", titleCn: "原名" })
    });

    // The override is the effective display title.
    expect(matchesPoolAnimeSearch(entry, "我的新标题")).toBe(true);
    // The original name stays searchable too.
    expect(matchesPoolAnimeSearch(entry, "Original Title")).toBe(true);
    expect(matchesPoolAnimeSearch(entry, "原名")).toBe(true);
  });

  it("reverts to the raw titles once the override is cleared", () => {
    const renamed = makeEntry({
      displayTitleOverride: "我的新标题",
      anime: makeAnime({ title: "Original Title" })
    });
    const cleared = makeEntry({
      displayTitleOverride: null,
      anime: makeAnime({ title: "Original Title" })
    });

    expect(matchesPoolAnimeSearch(renamed, "Original Title")).toBe(true);
    expect(matchesPoolAnimeSearch(cleared, "Original Title")).toBe(true);
    expect(getPoolAnimeSearchText(renamed)).toContain("我的新标题");
    expect(getPoolAnimeSearchText(cleared)).not.toContain("我的新标题");
  });
});

describe("isSuspiciousPoolAnimeTitle", () => {
  it("flags the unnamed placeholder", () => {
    const entry = makeEntry({ anime: makeAnime({ title: "未命名作品" }) });
    expect(isSuspiciousPoolAnimeTitle(entry)).toBe(true);
  });

  it("flags generic placeholders regardless of source", () => {
    expect(isSuspiciousPoolAnimeTitle(makeEntry({ anime: makeAnime({ title: "unknown" }) }))).toBe(true);
    expect(isSuspiciousPoolAnimeTitle(makeEntry({ anime: makeAnime({ title: "Untitled" }) }))).toBe(true);
    expect(isSuspiciousPoolAnimeTitle(makeEntry({ anime: makeAnime({ title: "image_12345" }) }))).toBe(true);
    expect(isSuspiciousPoolAnimeTitle(makeEntry({ anime: makeAnime({ title: "1234567890123456" }) }))).toBe(true);
  });

  it("does not flag a clean title", () => {
    const entry = makeEntry({ anime: makeAnime({ title: "Cowboy Bebop", titleCn: "星际牛仔" }) });
    expect(isSuspiciousPoolAnimeTitle(entry)).toBe(false);
  });

  it("normalises noisy user-generated titles to the placeholder", () => {
    const entry = makeEntry({
      anime: makeAnime({ source: "CUSTOM_UPLOAD", title: "https://tiermaker.com/list/abc" })
    });
    expect(isSuspiciousPoolAnimeTitle(entry)).toBe(true);
  });

  it("stops flagging once the user supplies a clean override", () => {
    const entry = makeEntry({
      displayTitleOverride: "我的作品",
      anime: makeAnime({ source: "CUSTOM_UPLOAD", title: "https://tiermaker.com/list/abc" })
    });
    expect(isSuspiciousPoolAnimeTitle(entry)).toBe(false);
  });
});
