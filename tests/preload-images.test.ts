import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatchPair, PublicAnimeWithScore } from "../src/lib/client-api";
import { preloadImage, preloadPairs } from "../src/lib/preload-images";

const requestedImageSources: string[] = [];

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    requestedImageSources.push(value);
    setTimeout(() => {
      if (value.includes("fail")) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 0);
  }
}

function makeAnime(id: string, imageUrl: string | null): PublicAnimeWithScore {
  return {
    id,
    bgmId: null,
    title: id,
    titleCn: null,
    titleJa: null,
    imageUrl,
    imageSmallUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    thumbnailUrl: null,
    airDate: null,
    bangumiRank: null,
    bangumiScore: null,
    tags: [],
    aliases: [],
    year: null,
    season: null,
    animeType: null,
    studios: [],
    source: "TEST",
    eloScore: 1500,
    uncertainty: 350,
    compareCount: 0
  };
}

function makePair(pairId: string, leftSrc: string | null, rightSrc: string | null): MatchPair {
  return {
    pairId,
    left: makeAnime(`${pairId}-left`, leftSrc),
    right: makeAnime(`${pairId}-right`, rightSrc),
    reason: "test"
  };
}

describe("preloadImage", () => {
  afterEach(() => {
    requestedImageSources.length = 0;
    vi.unstubAllGlobals();
  });

  it("returns false for empty src", async () => {
    await expect(preloadImage(null)).resolves.toBe(false);
    await expect(preloadImage(undefined)).resolves.toBe(false);
    await expect(preloadImage("")).resolves.toBe(false);
  });

  it("resolves true on image load", async () => {
    vi.stubGlobal("Image", MockImage);

    await expect(preloadImage("https://img.example/ok.jpg")).resolves.toBe(true);
  });

  it("resolves false on image error", async () => {
    vi.stubGlobal("Image", MockImage);

    await expect(preloadImage("https://img.example/fail.jpg")).resolves.toBe(false);
  });

  it("preloads a required first pair only once while counting all target images", async () => {
    vi.stubGlobal("Image", MockImage);

    const result = await preloadPairs(
      [
        makePair("pair-1", "https://img.example/left-1.jpg", "https://img.example/right-1.jpg"),
        makePair("pair-2", "https://img.example/left-2.jpg", "https://img.example/fail-right-2.jpg")
      ],
      { firstPairRequired: true, preloadCount: 2 }
    );

    expect(result).toEqual({ loaded: 3, total: 4 });
    expect(requestedImageSources).toEqual([
      "https://img.example/left-1.jpg",
      "https://img.example/right-1.jpg",
      "https://img.example/left-2.jpg",
      "https://img.example/fail-right-2.jpg"
    ]);
  });
});
