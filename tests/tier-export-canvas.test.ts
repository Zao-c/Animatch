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
          D: [tierItem({ animeId: "anime-2", id: "anime-2", imageUrl: null, coverUrl: null, thumbnailUrl: null })]
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
    expect(html).toContain("tiermaker-export-fallback");
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
