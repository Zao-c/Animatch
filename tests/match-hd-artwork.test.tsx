import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DuelAnimeCard } from "../src/components/DuelAnimeCard";
import { getMatchArtwork } from "../src/lib/match-artwork";
import type { PublicAnimeWithScore } from "../src/lib/client-api";

const distribution = { count: 0, mean: 1500, median: 1500, std: 120 };
const original = "/uploads/custom-items/original-2048.png";
const cos = "https://bucket.cos.ap-shanghai.myqcloud.com/animatch/covers/resized.webp";

function anime(overrides: Partial<PublicAnimeWithScore> = {}): PublicAnimeWithScore {
  return {
    id: "char-1", bgmId: null, title: "Character", titleCn: null,
    titleJa: null, titleEn: null, imageUrl: original,
    imageSmallUrl: null, imageMediumUrl: null, imageLargeUrl: original,
    cachedCoverUrl: cos, coverUrl: cos, thumbnailUrl: null,
    bangumiRank: null, bangumiScore: null, tags: [], aliases: [],
    year: null, season: null, animeType: null, studios: [],
    source: "CUSTOM_UPLOAD",
    eloScore: 1500, uncertainty: 100, compareCount: 0,
    ...overrides
  };
}

describe("Match HD artwork", () => {
  it("prefers full-resolution imported artwork over a low-resolution COS mirror", () => {
    const result = getMatchArtwork(anime());
    expect(result.src).toBe(
      "/api/cover-thumbnail?variant=match&src=%2Fuploads%2Fcustom-items%2Foriginal-2048.png"
    );
    expect(result.secondarySrc).toBe(
      "/api/cover-thumbnail?variant=match&src=" + encodeURIComponent(cos)
    );
    expect(result.fallbackSrcs).toContain(original);
    expect(result.fallbackSrcs).toContain(cos);
    expect(result.fit).toBe("cover");
  });

  it("respects a manually replaced cover instead of an older imported original", () => {
    const override = "/uploads/anime-covers/new-custom.png";
    const result = getMatchArtwork(anime({ coverUrlOverride: override }));
    expect(result.src).toBe(
      "/api/cover-thumbnail?variant=match&src=%2Fuploads%2Fanime-covers%2Fnew-custom.png"
    );
  });

  it("does not treat ordinary anime posters as imported character artwork", () => {
    const result = getMatchArtwork(anime({
      source: "BANGUMI",
      coverUrl: cos,
      imageUrl: "https://lain.bgm.tv/pic/cover/l/anime.jpg",
      imageLargeUrl: "https://lain.bgm.tv/pic/cover/l/anime.jpg"
    }));
    expect(result.src).toBe(cos);
    expect(result.fit).toBe("contain");
  });

  it("renders the processed HD image in Match cards while preserving the choice button", () => {
    const html = renderToStaticMarkup(React.createElement(DuelAnimeCard, {
      anime: anime(), side: "left", disabled: false,
      actionLabel: "更喜欢左边", onPick: () => undefined,
      scoreDistribution: distribution
    }));
    expect(html).toContain("variant=match");
    expect(html).toContain('data-cover-fit="cover"');
    expect(html).toContain("选择左边");
  });
});
