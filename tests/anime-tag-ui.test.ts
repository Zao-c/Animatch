import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCard } from "../src/components/AnimeCard";
import type { PublicAnime } from "../src/lib/client-api";

describe("anime tag UI", () => {
  const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
  const poolsSource = readFileSync("src/app/pools/page.tsx", "utf8");

  it("renders anime result tags as Chinese labels", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCard, {
        anime: anime({ tags: ["romance", "school"] }),
      })
    );

    expect(html).toContain("恋爱");
    expect(html).toContain("校园");
    expect(html).not.toContain(">romance<");
    expect(html).not.toContain(">school<");
  });

  it("keeps selected tag chips in Chinese on the add-anime panel", () => {
    expect(detailSource).toContain("QUICK_SEARCH_TAGS");
    expect(detailSource).toContain("selectedSearchTags.map");
    expect(detailSource).toContain("labelAnimeTag(tag)");
    expect(detailSource).toContain("清空筛选");
  });

  it("shows common tags and grouped more tags in the add-anime panel", () => {
    expect(detailSource).toContain("常用标签");
    expect(detailSource).toContain("更多标签");
    expect(detailSource).toContain("GROUPED_SEARCH_TAGS");
    expect(detailSource).toContain("getTagGroupLabel(group.group)");
    expect(detailSource).toContain('"类型"');
    expect(detailSource).toContain('"场景"');
    expect(detailSource).toContain('"氛围"');
    expect(detailSource).toContain('"题材"');
    expect(detailSource).toContain('"形式"');
  });

  it("toggles tag buttons into and out of selectedSearchTags", () => {
    expect(detailSource).toContain("function toggleSearchTag(tagKey: string)");
    expect(detailSource).toContain("current.includes(tagKey)");
    expect(detailSource).toContain("current.filter((tag) => tag !== tagKey)");
    expect(detailSource).toContain("[...current, tagKey]");
  });

  it("shows tag suggestions from search input and adds clicked suggestions", () => {
    expect(detailSource).toContain("const tagSuggestions = useMemo");
    expect(detailSource).toContain("suggestAnimeTags(searchKeyword, 6)");
    expect(detailSource).toContain("标签联想");
    expect(detailSource).toContain("function addSuggestedSearchTag(tag: AnimeTagDictionaryEntry)");
    expect(detailSource).toContain("addSuggestedSearchTag(tag)");
    expect(detailSource).toContain("formatTagSuggestionMeta(tag)");
  });

  it("only clears the query after suggestion click when the query exactly equals the tag term", () => {
    expect(detailSource).toContain("const isExactTagQuery = [tag.key, tag.label, ...tag.aliases]");
    expect(detailSource).toContain("if (isExactTagQuery)");
    expect(detailSource).toContain("setSearchKeyword(\"\")");
  });

  it("sends query and selected tags together through discover", () => {
    expect(detailSource).toContain("const data = await discoverAnime({");
    expect(detailSource).toContain("q: searchKeyword.trim() || undefined");
    expect(detailSource).toContain("tags: selectedSearchTags");
    expect(detailSource).not.toContain("searchAnime(");
  });

  it("keeps the add-anime filters wrapped for narrow mobile widths", () => {
    expect(detailSource).toContain("flex flex-wrap gap-2");
    expect(detailSource).toContain("grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]");
    expect(detailSource).toContain("anime-field min-w-0");
  });

  it("labels pool tags with the Chinese tag dictionary", () => {
    expect(detailSource).toContain("labelAnimeTag(tag)");
    expect(poolsSource).toContain("labelAnimeTag(tag)");
  });
});

function anime(overrides: Partial<PublicAnime> = {}): PublicAnime {
  return {
    id: "anime-1",
    bgmId: 1,
    title: "Test Anime",
    titleCn: "测试动画",
    titleJa: null,
    titleEn: null,
    imageUrl: null,
    imageSmallUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    coverUrl: null,
    thumbnailUrl: null,
    airDate: null,
    bangumiRank: null,
    bangumiScore: null,
    tags: [],
    aliases: [],
    year: 2026,
    season: null,
    animeType: "TV",
    studios: [],
    source: "MANAMI",
    ...overrides,
  };
}
