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
