import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";
import { DuelAnimeCard } from "../src/components/DuelAnimeCard";
import { TierAnimeCard } from "../src/components/TierAnimeCard";
import {
  getAnimeDisplayTitle,
  getAnimeImageFitMode,
  isGeneratedOrNoisyTitle,
  isImageFocusedSource
} from "../src/lib/anime-display";
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
    expect(html).toContain("封面暂不可用");
  });

  it("AnimeCover renders every image with no-referrer and supports contain mode", () => {
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

  it("AnimeCover applies no-referrer to ordinary cover images too", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://img.example.test/bangumi.jpg",
        title: "Bangumi Cover",
        fit: "cover"
      })
    );

    expect(html).toContain("src=\"/api/image-proxy?url=https%3A%2F%2Fimg.example.test%2Fbangumi.jpg\"");
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain('data-cover-fit="cover"');
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

  it("DuelAnimeCard prefers imageMediumUrl over imageUrl for hero covers", () => {
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

    expect(html).toContain("src=\"/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fmedium.jpg\"");
    expect(html).not.toContain("thumb.jpg");
    expect(html).toContain('data-cover-fit="cover"');
    expect(html).toContain('referrerPolicy="no-referrer"');
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
    expect(html).toContain("min-h-[3.25rem]");
    expect(html).toContain("mt-auto w-full");
    expect(html).toContain("未命名作品");
    expect(html).not.toContain("17750273769085f154");
  });

  it("anime display helpers contain user images and protect normal titles", () => {
    expect(isImageFocusedSource("TIERMAKER_IMPORT")).toBe(true);
    expect(isImageFocusedSource("CUSTOM_UPLOAD")).toBe(true);
    expect(getAnimeImageFitMode({ source: "TIERMAKER_IMPORT" })).toBe("contain");
    expect(getAnimeImageFitMode({ source: "BANGUMI" })).toBe("contain");
    expect(isGeneratedOrNoisyTitle("https://tiermaker.com/create/abc-17750273769085")).toBe(true);
    expect(
      getAnimeDisplayTitle({
        source: "TIERMAKER_IMPORT",
        title: "https://tiermaker.com/create/abc-17750273769085"
      })
    ).toBe("未命名作品");
    expect(getAnimeDisplayTitle({ source: "BANGUMI", titleCn: "葬送的芙莉莲" })).toBe(
      "葬送的芙莉莲"
    );
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

  it("TierAnimeCard prefers imageMediumUrl over imageUrl for display covers", () => {
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

    expect(html).toContain('src="https://example.com/medium.jpg"');
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

  it("TierAnimeCard shows /10 and keeps battle count low emphasis", () => {
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
    expect(html).toContain("3 battles");
    expect(html).not.toContain("Elo 1554.3");
  });
});

describe("match cover stability", () => {
  it("AnimeCover size=lg uses aspect-ratio for responsive height", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/large.jpg",
        title: "Responsive Test",
        size: "lg"
      })
    );

    expect(html).toContain("aspect-[2/3]");
    expect(html).toContain("sm:max-h-[420px]");
  });

  it("AnimeCover size=sm and size=md keep fixed dimensions", () => {
    const smHtml = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/small.jpg",
        title: "Small",
        size: "sm"
      })
    );
    const mdHtml = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/medium.jpg",
        title: "Medium",
        size: "md"
      })
    );

    expect(smHtml).toContain("h-20 w-14");
    expect(mdHtml).toContain("h-36 w-24");
  });

  it("AnimeCover shows cover fallback when src is null and no secondarySrc", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        secondarySrc: null,
        title: "冰菓",
        size: "lg"
      })
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("封面暂不可用");
    expect(html).toContain("冰菓");
  });

  it("AnimeCover shows cover fallback when both src and secondarySrc are null", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        secondarySrc: null,
        title: "葬送的芙莉莲",
        size: "lg"
      })
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("封面暂不可用");
    expect(html).toContain("葬送的芙莉莲");
    expect(html).toContain("aspect-[2/3]");
  });

  it("DuelAnimeCard renders imageLargeUrl when imageUrl is also present (hero intent)", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "BANGUMI",
          imageUrl: "https://example.com/high.jpg",
          imageLargeUrl: "https://example.com/large.jpg",
          imageMediumUrl: "https://example.com/medium.jpg",
          imageSmallUrl: null,
          thumbnailUrl: null,
          coverUrl: null
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain(
      "src=\"/api/image-proxy?url=https%3A%2F%2Fexample.com%2Flarge.jpg\""
    );
  });

  it("DuelAnimeCard shows only primary cover when no other URLs differ (hero==export)", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "BANGUMI",
          imageUrl: null,
          imageLargeUrl: "https://example.com/large.jpg",
          imageMediumUrl: null,
          imageSmallUrl: null,
          thumbnailUrl: null,
          coverUrl: null
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain(
      "src=\"/api/image-proxy?url=https%3A%2F%2Fexample.com%2Flarge.jpg\""
    );
  });

  it("DuelAnimeCard shows fallback when anime has no cover URLs at all", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "BANGUMI",
          titleCn: "无封面作品",
          imageUrl: null,
          imageLargeUrl: null,
          imageMediumUrl: null,
          imageSmallUrl: null,
          thumbnailUrl: null,
          coverUrl: null
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("封面暂不可用");
    expect(html).toContain("无封面作品");
  });

  it("DuelAnimeCard renders cover from imageSmallUrl when no larger sizes available", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "BANGUMI",
          titleCn: "小封面",
          imageUrl: null,
          imageLargeUrl: null,
          imageMediumUrl: null,
          imageSmallUrl: "https://example.com/small.jpg",
          thumbnailUrl: null,
          coverUrl: null
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain(
      "src=\"/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fsmall.jpg\""
    );
  });

  it("DuelAnimeCard renders cover from thumbnailUrl when only thumbnail available", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "BANGUMI",
          titleCn: "缩略图作品",
          imageUrl: null,
          imageLargeUrl: null,
          imageMediumUrl: null,
          imageSmallUrl: null,
          thumbnailUrl: "https://example.com/thumb.jpg",
          coverUrl: null
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain(
      "src=\"/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fthumb.jpg\""
    );
  });

  it("DuelAnimeCard includes side badge LEFT/RIGHT", () => {
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

    expect(html).toContain("LEFT");
  });

  it("DuelAnimeCard right side shows RIGHT badge", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime(),
        side: "right",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain("RIGHT");
  });
});

describe("match cover resilience", () => {
  it("AnimeCover always has visible skeleton layer with first letter", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/cover.jpg",
        title: "冰菓",
        size: "lg"
      })
    );

    expect(html).toContain("absolute inset-0");
    expect(html).toContain("冰");
  });

  it("AnimeCover shows skeleton even when img is present (loading state)", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/cover.jpg",
        title: "葬送的芙莉莲",
        size: "lg"
      })
    );

    expect(html).toContain("<img");
    expect(html).toContain("葬");
  });

  it("AnimeCover uses eager loading on img", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/cover.jpg",
        title: "Eager Test",
        size: "lg"
      })
    );

    expect(html).toContain('loading="eager"');
  });

  it("AnimeCover has data-cover-state=loading when src present and not yet loaded", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/large.jpg",
        title: "Loading State",
        size: "lg"
      })
    );

    expect(html).toContain('data-cover-state="loading"');
    expect(html).toContain('data-cover-url-present="true"');
    expect(html).toContain('opacity-0');
  });

  it("AnimeCover has data-cover-state=empty when no src", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: null,
        secondarySrc: null,
        title: "Empty Cover",
        size: "lg"
      })
    );

    expect(html).toContain('data-cover-state="empty"');
    expect(html).toContain('data-cover-url-present="false"');
    expect(html).toContain("封面暂不可用");
  });

  it("AnimeCover passes animeId into data-anime-id", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/cover.jpg",
        title: "With ID",
        animeId: "anime-42"
      })
    );

    expect(html).toContain('data-anime-id="anime-42"');
  });

  it("AnimeCover empty data-anime-id when no animeId prop", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/cover.jpg",
        title: "No ID"
      })
    );

    expect(html).toContain('data-anime-id=""');
  });

  it("AnimeCover skeleton hides fallback text when image is loading", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnimeCover, {
        src: "https://example.com/cover.jpg",
        title: "Some Anime Title",
        size: "lg"
      })
    );

    expect(html).toContain('data-cover-state="loading"');
    expect(html).not.toContain("text-zinc-400\">封面暂不可用");
  });

  it("DuelAnimeCard has data-cover-state and data-anime-id on cover div", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({ id: "anime-match-99" }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain('data-anime-id="anime-match-99"');
  });

  it("img in DuelAnimeCard is not lazy loaded", () => {
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

    expect(html).toContain('loading="eager"');
    expect(html).not.toContain('loading="lazy"');
  });

  it("DuelAnimeCard cover area has stable aspect ratio on mobile", () => {
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

    expect(html).toContain("aspect-[2/3]");
  });

  it("DuelAnimeCard with Bangumi CDN source still renders real remote image", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "BANGUMI",
          imageUrl: null,
          imageLargeUrl: "https://lain.bgm.tv/r/400/pic/cover/l/abc.jpg",
          imageMediumUrl: null,
          imageSmallUrl: null,
          thumbnailUrl: null,
          coverUrl: null,
          titleCn: "葬送的芙莉莲"
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain(
      "src=\"/api/image-proxy?url=https%3A%2F%2Flain.bgm.tv%2Fr%2F400%2Fpic%2Fcover%2Fl%2Fabc.jpg\""
    );
    expect(html).not.toContain("/demo-covers/");
    expect(html).not.toContain("/brand/fallback");
  });

  it("DuelAnimeCard fallback shows title when no cover URLs", () => {
    const html = renderToStaticMarkup(
      React.createElement(DuelAnimeCard, {
        anime: baseAnime({
          source: "BANGUMI",
          titleCn: "无封面作品",
          id: "no-cover-anime",
          imageUrl: null,
          imageLargeUrl: null,
          imageMediumUrl: null,
          imageSmallUrl: null,
          thumbnailUrl: null,
          coverUrl: null,
          coverUrlOverride: null
        }),
        side: "left",
        disabled: false,
        actionLabel: "Pick",
        scoreDistribution,
        onPick: () => undefined
      })
    );

    expect(html).toContain('data-cover-state="empty"');
    expect(html).toContain('data-cover-url-present="false"');
    expect(html).toContain("封面暂不可用");
    expect(html).toContain("无封面作品");
  });
});
