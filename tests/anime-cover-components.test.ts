import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";
import { DuelAnimeCard } from "../src/components/DuelAnimeCard";
import { TierAnimeCard } from "../src/components/TierAnimeCard";
import type { PublicAnimeWithScore, TierListItem } from "../src/lib/client-api";

const scoreDistribution = {
  count: 3,
  mean: 1500,
  median: 1500,
  std: 80
};

function baseAnime(overrides: Partial<PublicAnimeWithScore> = {}): PublicAnimeWithScore {
  return {
    id: "anime-1",
    bgmId: null,
    title: "Custom Upload",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    imageUrl: "/uploads/custom-items/test.png",
    imageSmallUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    coverUrl: "/uploads/custom-items/test.png",
    thumbnailUrl: "/uploads/custom-items/test.png",
    airDate: null,
    bangumiRank: null,
    bangumiScore: null,
    tags: [],
    aliases: [],
    year: null,
    season: null,
    animeType: "IMAGE",
    studios: [],
    source: "CUSTOM_UPLOAD",
    eloScore: 1500,
    uncertainty: 350,
    compareCount: 0,
    ...overrides
  };
}

function tierItem(overrides: Partial<TierListItem> = {}): TierListItem {
  return {
    ...baseAnime(),
    animeId: "anime-1",
    winCount: 0,
    lossCount: 0,
    drawCount: 0,
    unseenCount: 0,
    skipCount: 0,
    manualTier: null,
    manualRank: null,
    manualLocked: false,
    ...overrides
  };
}

describe("anime cover rendering", () => {
  it("AnimeCover renders local custom upload paths as img", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "/uploads/custom-items/test.png",
        title: "Local Cover"
      })
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/uploads/custom-items/test.png"');
  });

  it("AnimeCover renders fallback when src is empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        title: "Fallback Title"
      })
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("Fallback Title");
    expect(html).toContain("图片暂时无法加载");
  });

  it("AnimeCover can render user imported images with object-contain and no referrer", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "http://tiermaker.example/image.png",
        title: "Imported image",
        fit: "contain"
      })
    );

    expect(html).toContain('data-cover-fit="contain"');
    expect(html).toContain("object-contain");
    expect(html).toContain('referrerPolicy="no-referrer"');
  });

  it("DuelAnimeCard renders an img when coverUrl is present", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime(),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/uploads/custom-items/test.png"');
    expect(html).toContain('data-cover-fit="contain"');
  });

  it("DuelAnimeCard prefers imageUrl over thumbnailUrl for hero covers", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "MANAMI",
          imageUrl: "https://example.com/high.jpg",
          imageMediumUrl: "https://example.com/medium.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg",
          coverUrl: "https://example.com/thumb.jpg"
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain('src="https://example.com/high.jpg"');
    expect(html).not.toContain('src="https://example.com/thumb.jpg"');
    expect(html).toContain('data-cover-fit="cover"');
    expect(html).not.toContain('referrerPolicy="no-referrer"');
  });

  it("DuelAnimeCard keeps the card height stable and action aligned", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "TIERMAKER_IMPORT",
          title: "zzzzz 17750273769085f154 f2a3b4c5d6e7f8"
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain("flex h-full flex-col");
    expect(html).toContain("min-h-[4rem]");
    expect(html).toContain("mt-auto w-full");
    expect(html).toContain("未命名作品");
    expect(html).not.toContain("17750273769085f154");
  });

  it("TierAnimeCard renders an img when coverUrl is present", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierAnimeCard, {
        item: tierItem(),
        editable: false,
        scoreDistribution,
        onDragStart: () => undefined,
        onDropBefore: () => undefined
      })
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/uploads/custom-items/test.png"');
    expect(html).toContain('data-cover-fit="contain"');
  });

  it("TierAnimeCard prefers imageUrl over thumbnailUrl for display covers", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierAnimeCard, {
        item: tierItem({
          source: "MANAMI",
          imageUrl: "https://example.com/high.jpg",
          imageMediumUrl: "https://example.com/medium.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg",
          coverUrl: "https://example.com/thumb.jpg"
        }),
        editable: false,
        scoreDistribution,
        onDragStart: () => undefined,
        onDropBefore: () => undefined
      })
    );

    expect(html).toContain('src="https://example.com/high.jpg"');
    expect(html).not.toContain('src="https://example.com/thumb.jpg"');
    expect(html).toContain('data-cover-fit="cover"');
  });

  it("TierAnimeCard disables drag interaction in export mode", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierAnimeCard, {
        item: tierItem(),
        editable: true,
        exportMode: true,
        scoreDistribution,
        onDragStart: () => undefined,
        onDropBefore: () => undefined
      })
    );

    expect(html).not.toContain('draggable="true"');
    expect(html).toContain("Custom Upload");
  });

  it("DuelAnimeCard shows AniScore as the primary score", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({ eloScore: 1554.3 }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain("AniScore");
    expect(html).toContain("/ 10");
    expect(html).not.toContain("1554.3");
  });

  it("TierAnimeCard shows /10 and keeps Elo secondary", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierAnimeCard, {
        item: tierItem({ eloScore: 1554.3, compareCount: 3 }),
        editable: false,
        scoreDistribution,
        onDragStart: () => undefined,
        onDropBefore: () => undefined
      })
    );

    expect(html).toContain("/ 10");
    expect(html).toContain("对决 3");
    expect(html).toContain("Elo 1554");
    expect(html).not.toContain("Elo 1554.3");
  });
});
