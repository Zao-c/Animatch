import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";
import { DuelAnimeCard } from "../src/components/DuelAnimeCard";
import { TierAnimeCard } from "../src/components/TierAnimeCard";
import type { PublicAnimeWithScore, TierListItem } from "../src/lib/client-api";

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
  });

  it("DuelAnimeCard renders an img when coverUrl is present", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime(),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        onPick: () => undefined
      })
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/uploads/custom-items/test.png"');
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
        onPick: () => undefined
      })
    );

    expect(html).toContain('src="https://example.com/high.jpg"');
    expect(html).not.toContain('src="https://example.com/thumb.jpg"');
  });

  it("TierAnimeCard renders an img when coverUrl is present", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierAnimeCard, {
        item: tierItem(),
        editable: false,
        onDragStart: () => undefined,
        onDropBefore: () => undefined
      })
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="/uploads/custom-items/test.png"');
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
        onDragStart: () => undefined,
        onDropBefore: () => undefined
      })
    );

    expect(html).toContain('src="https://example.com/high.jpg"');
    expect(html).not.toContain('src="https://example.com/thumb.jpg"');
  });

  it("TierAnimeCard disables drag interaction in export mode", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierAnimeCard, {
        item: tierItem(),
        editable: true,
        exportMode: true,
        onDragStart: () => undefined,
        onDropBefore: () => undefined
      })
    );

    expect(html).not.toContain('draggable="true"');
    expect(html).toContain("Custom Upload");
  });
});
