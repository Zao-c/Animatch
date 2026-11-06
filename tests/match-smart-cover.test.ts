import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DuelAnimeCard } from "../src/components/DuelAnimeCard";
import type { PublicAnimeWithScore } from "../src/lib/client-api";

const distribution = { count: 0, mean: 1500, median: 1500, std: 120 };
const artwork = "/uploads/custom-items/character.png";

function anime(source: string, imageUrl: string): PublicAnimeWithScore {
  return {
    id: "anime-1",
    bgmId: null,
    title: "Imported character",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    source,
    imageUrl,
    imageLargeUrl: null,
    imageMediumUrl: null,
    imageSmallUrl: null,
    cachedCoverUrl: null,
    thumbnailUrl: null,
    coverUrl: imageUrl,
    bangumiRank: null,
    bangumiScore: null,
    tags: [],
    aliases: [],
    year: null,
    season: null,
    animeType: null,
    studios: [],
    eloScore: 1500,
    uncertainty: 100,
    compareCount: 0
  };
}

function render(source: string, url: string) {
  return renderToStaticMarkup(
    React.createElement(DuelAnimeCard, {
      anime: anime(source, url),
      side: "left",
      disabled: false,
      actionLabel: "更喜欢左边",
      onPick: () => undefined,
      scoreDistribution: distribution
    })
  );
}

describe("Match artwork thumbnails", () => {
  it("renders imported character artwork in the 2:3 smart cover instead of contain", () => {
    const html = render("CUSTOM_UPLOAD", artwork);
    expect(html).toContain("data-cover-fit=\"cover\"");
    expect(html).toContain("/api/cover-thumbnail?variant=match&amp;src=%2Fuploads%2Fcustom-items%2Fcharacter.png");
    expect(html).toContain(artwork);
    expect(html).toContain("选择左边");
  });

  it("also composes older TierMaker images", () => {
    const html = render("TIERMAKER_IMPORT", artwork);
    expect(html).toContain("data-cover-fit=\"cover\"");
    expect(html).toContain("variant=match");
  });

  it("keeps existing contain rendering for ordinary poster URLs", () => {
    const html = render("BANGUMI", "https://lain.bgm.tv/pic/cover/l/poster.jpg");
    expect(html).toContain("data-cover-fit=\"contain\"");
    expect(html).not.toContain("/api/cover-thumbnail");
  });
});
