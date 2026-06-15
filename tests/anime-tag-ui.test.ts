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
