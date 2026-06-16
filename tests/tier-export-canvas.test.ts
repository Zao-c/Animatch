import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TierExportCanvas } from "../src/components/TierExportCanvas";
import type { TierListItem } from "../src/lib/client-api";

function tierItem(overrides: Partial<TierListItem> = {}): TierListItem {
  return {
    id: "anime-1",
    animeId: "anime-1",
    bgmId: null,
    title: "Export Test",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    imageUrl: "/uploads/custom-items/export-test.png",
    imageSmallUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    coverUrl: "/uploads/custom-items/export-test.png",
    thumbnailUrl: "/uploads/custom-items/export-test.png",
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
    compareCount: 2,
    winCount: 1,
    lossCount: 1,
    drawCount: 0,
    unseenCount: 0,
    skipCount: 0,
    manualTier: null,
    manualRank: null,
    manualLocked: false,
    ...overrides
  };
}

describe("TierExportCanvas", () => {
  it("renders a compact tier wall with logo and tier rows", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierExportCanvas, {
        tiers: {
          S: [tierItem()],
          A: [],
          B: [],
          C: [],
          D: [
            tierItem({
              animeId: "anime-2",
              id: "anime-2",
              imageUrl: null,
              coverUrl: null,
              thumbnailUrl: null
            })
          ]
        }
      })
    );

    expect(html).toContain('data-testid="tier-export-canvas"');
    expect(html).toContain("AniMatch");
    expect(html).toContain(">S<");
    expect(html).toContain(">A<");
    expect(html).toContain(">B<");
    expect(html).toContain(">C<");
    expect(html).toContain(">D<");
    expect(html).toContain('src="/uploads/custom-items/export-test.png"');
    expect(html).toContain("tiermaker-export-image-contain");
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain("tiermaker-export-fallback");
  });

  it("renders custom tier labels and uses export cover intent", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierExportCanvas, {
        labels: {
          S: "神作",
          A: "喜欢",
          B: "普通",
          C: "待定",
          D: "跳过"
        },
        tiers: {
          S: [
            tierItem({
              source: "MANAMI",
              imageLargeUrl: "https://example.com/large.jpg",
              imageUrl: "https://example.com/high.jpg",
              coverUrl: "https://example.com/thumb.jpg",
              thumbnailUrl: "https://example.com/thumb.jpg"
            })
          ],
          A: [],
          B: [],
          C: [],
          D: []
        }
      })
    );

    expect(html).toContain("神作");
    expect(html).toContain("喜欢");
    expect(html).toContain("普通");
    expect(html).toContain("待定");
    expect(html).toContain("跳过");
    expect(html).toContain("/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fhigh.jpg");
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).not.toContain('src="https://example.com/large.jpg"');
    expect(html).not.toContain('src="https://example.com/thumb.jpg"');
    expect(html).not.toContain("tiermaker-export-image-contain");
  });

  it("hides noisy TierMaker titles in export aria labels", () => {
    const noisyTitle = "zzzzz 17750273769085f154 f2a3b4c5d6e7f8";
    const html = renderToStaticMarkup(
      React.createElement(TierExportCanvas, {
        tiers: {
          S: [tierItem({ source: "TIERMAKER_IMPORT", title: noisyTitle })],
          A: [],
          B: [],
          C: [],
          D: []
        }
      })
    );

    expect(html).toContain('aria-label="未命名作品"');
    expect(html).not.toContain(noisyTitle);
  });

  it("uses real imageUrl covers for tier wall items with images", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierExportCanvas, {
        tiers: {
          S: [
            tierItem({
              animeId: "anime-1",
              id: "anime-1",
              title: "One Piece",
              imageUrl: "https://img.example.test/one-piece.jpg",
              imageLargeUrl: "https://img.example.test/one-piece-large.jpg",
              coverUrl: null,
              thumbnailUrl: null
            }),
            tierItem({
              animeId: "anime-2",
              id: "anime-2",
              title: "Chainsaw Man",
              imageUrl: "https://img.example.test/chainsaw-man.jpg",
              imageLargeUrl: "https://img.example.test/chainsaw-man-large.jpg",
              coverUrl: null,
              thumbnailUrl: null
            })
          ],
          A: [],
          B: [],
          C: [],
          D: []
        }
      })
    );

    expect(html).toContain("/api/image-proxy?url=https%3A%2F%2Fimg.example.test%2Fone-piece.jpg");
    expect(html).toContain("/api/image-proxy?url=https%3A%2F%2Fimg.example.test%2Fchainsaw-man.jpg");
    expect(html).not.toContain("tiermaker-export-fallback");
    expect(html).not.toContain("one-piece-large.jpg");
    expect(html).not.toContain("chainsaw-man-large.jpg");
  });

  it("falls back only the failed tier wall item", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierExportCanvas, {
        failedImageIds: new Set(["anime-2"]),
        tiers: {
          S: [
            tierItem({
              animeId: "anime-1",
              id: "anime-1",
              title: "One Piece",
              imageUrl: "https://img.example.test/one-piece.jpg",
              coverUrl: null,
              thumbnailUrl: null
            }),
            tierItem({
              animeId: "anime-2",
              id: "anime-2",
              title: "Chainsaw Man",
              imageUrl: "https://img.example.test/chainsaw-man.jpg",
              coverUrl: null,
              thumbnailUrl: null
            })
          ],
          A: [],
          B: [],
          C: [],
          D: []
        }
      })
    );

    expect(html).toContain("/api/image-proxy?url=https%3A%2F%2Fimg.example.test%2Fone-piece.jpg");
    expect(html).not.toContain("/api/image-proxy?url=https%3A%2F%2Fimg.example.test%2Fchainsaw-man.jpg");
    expect(html.match(/tiermaker-export-fallback/g)).toHaveLength(1);
  });

  it("does not render page chrome, stats, explanatory text, or item scores", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierExportCanvas, {
        tiers: {
          S: [tierItem()],
          A: [],
          B: [],
          C: [],
          D: []
        }
      })
    );

    expect(html).not.toContain("信心指数");
    expect(html).not.toContain("总作品");
    expect(html).not.toContain("已比较作品");
    expect(html).not.toContain("总对决");
    expect(html).not.toContain("返回番组");
    expect(html).not.toContain("继续对决");
    expect(html).not.toContain("校准榜单");
    expect(html).not.toContain("编辑最终设定");
    expect(html).not.toContain("恢复系统排序");
    expect(html).not.toContain("Elo");
    expect(html).not.toContain("Locked");
    expect(html).not.toContain("Edited");
  });
});
