import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TierAnimeCard } from "@/components/TierAnimeCard";
import { TierExportCanvas } from "@/components/TierExportCanvas";
import { TierShareView } from "@/components/TierShareView";

function baseItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "anime-1",
    animeId: "anime-1",
    source: "BANGUMI",
    title: "Steins;Gate",
    titleCn: "命运石之门",
    titleJa: null,
    titleEn: null,
    imageUrl: "https://example.com/image.jpg",
    imageLargeUrl: "https://example.com/large.jpg",
    imageMediumUrl: null,
    imageSmallUrl: null,
    thumbnailUrl: null,
    coverUrl: "https://example.com/large.jpg",
    animeType: "TV",
    eloScore: 1500,
    uncertainty: 80,
    compareCount: 12,
    winCount: 5,
    lossCount: 4,
    drawCount: 1,
    unseenCount: 0,
    skipCount: 2,
    manualTier: null,
    manualRank: null,
    manualLocked: false,
    ...overrides
  };
}

describe("Tier confidence label uses personal language", () => {
  it('tier page stats use "我的稳定度" not "信心指数"', () => {
    const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");
    expect(source).toContain('"我的稳定度"');
    expect(source).not.toContain('"信心指数"');
  });

  it('tier page description uses "稳定度" not "信心指数"', () => {
    const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");
    expect(source).toContain("稳定度会更准确");
    expect(source).not.toContain("信心指数会更准确");
  });

  it('match page uses "我的稳定度"', () => {
    const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");
    expect(source).toContain('"我的稳定度"');
  });

  it('pools list uses "榜单稳定度" not "信心"', () => {
    const source = readFileSync("src/app/pools/page.tsx", "utf8");
    expect(source).toContain("榜单稳定度");
    expect(source).not.toContain("· 信心 ");
  });

  it("tier page shows community participant count when available", () => {
    const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");
    expect(source).toContain("社区参与");
    expect(source).toContain("totalParticipants");
  });

  it("community participant does not show when totalParticipants is 0", () => {
    const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");
    expect(source).toContain("totalParticipants > 0");
  });
});

describe("TierAnimeCard uses export intent for secondarySrc", () => {
  it("uses getAnimeCoverUrl with export intent for secondarySrc", () => {
    const source = readFileSync("src/components/TierAnimeCard.tsx", "utf8");
    expect(source).toContain('getAnimeCoverUrl(item, { intent: "export" })');
    expect(source).toContain("const secondaryUrl = getAnimeCoverUrl");
    expect(source).toContain("secondarySrc={secondaryUrl}");
  });

  it("does not use raw imageSmallUrl as first secondary fallback", () => {
    const source = readFileSync("src/components/TierAnimeCard.tsx", "utf8");
    expect(source).not.toContain("item.imageSmallUrl ?? item.imageMediumUrl");
  });
});

describe("Pool detail API returns tierConfig", () => {
  it("GET pool detail response includes tierConfig", () => {
    const source = readFileSync("src/app/api/pools/[poolId]/route.ts", "utf8");
    expect(source).toContain("tierConfig: pool.tierConfig");
    expect(source).toContain("import type { PoolTierConfig }");
  });
});

describe("MANAMI image urls in TierAnimeCard", () => {
  it("MANAMI item in TierAnimeCard uses intent:export as secondary, not imageSmallUrl", () => {
    const manamiItem = baseItem({
      source: "MANAMI",
      imageMediumUrl: "https://manami.example/picture.jpg",
      imageSmallUrl: "https://manami.example/thumbnail.jpg",
      imageLargeUrl: null,
      imageUrl: "https://manami.example/picture.jpg",
      coverUrl: "https://manami.example/thumbnail.jpg",
      thumbnailUrl: "https://manami.example/thumbnail.jpg"
    });

    const scoreDistribution = [
      { eloScore: 1200, count: 3 },
      { eloScore: 1300, count: 5 },
      { eloScore: 1500, count: 10 }
    ];

    const html = renderToStaticMarkup(
      React.createElement(TierAnimeCard, {
        item: manamiItem,
        editable: false,
        scoreDistribution,
        onDragStart: () => {}
      })
    );

    // MANAMI display intent picks imageMediumUrl (picture) as primary
    // Export intent also picks imageMediumUrl since imageLargeUrl is null
    // Both should be the high-quality picture, not the thumbnail
    expect(html).toContain("data-export-secondary-src=\"https://manami.example/picture.jpg\"");
    expect(html).not.toContain("data-export-secondary-src=\"https://manami.example/thumbnail.jpg\"");
  });
});

describe("TierShareView hides badges", () => {
  const source = readFileSync("src/components/TierShareView.tsx", "utf8");

  it("share page non-export mode does not render source badges", () => {
    // In the !exportMode branch, we should NOT render AppBadge for source or type
    const nonExportBranch = source.slice(
      source.indexOf("!exportMode ?"),
      source.indexOf(":", source.indexOf("!exportMode ?") + 50)
    );
    expect(nonExportBranch).not.toContain("AppBadge");
    expect(nonExportBranch).not.toContain("source");
    expect(nonExportBranch).not.toContain("status");
  });

  it("export mode uses sr-only for title", () => {
    expect(source).toContain('className="sr-only">{title}');
  });

  it("non-export mode shows title in small muted text", () => {
    expect(source).toContain("text-slate-400");
  });

  it("isUserGeneratedImageSource is no longer imported in TierShareView", () => {
    expect(source).not.toContain("isUserGeneratedImageSource");
  });
});

describe("Tier export canvas is cover-only", () => {
  it("does not render source badges in export canvas", () => {
    const items: Record<string, unknown[]> = {
      s: [
        baseItem({ source: "BANGUMI", animeType: "TV" }) as unknown,
        baseItem({ source: "MANAMI", animeType: "TV" }) as unknown
      ],
      a: [baseItem() as unknown],
      b: [],
      c: [],
      d: []
    };

    const html = renderToStaticMarkup(
      React.createElement(TierExportCanvas, {
        tiers: items as Parameters<typeof TierExportCanvas>[0]["tiers"]
      })
    );

    expect(html).toContain("tier-export-canvas");
    expect(html).not.toContain("Bangumi");
    expect(html).not.toContain("MANAMI");
    expect(html).not.toContain("TV");
    expect(html).not.toContain("badge");
  });
});
