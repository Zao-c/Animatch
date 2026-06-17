import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { TierSharePanel } from "../src/components/TierSharePanel";
import { TierShareMissingView, TierShareView } from "../src/components/TierShareView";
import type { PublicTierShare } from "../src/lib/client-api";

describe("TierShareView", () => {
  it("renders snapshot labels and items without mutation controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierShareView, {
        share: {
          token: "token-1",
          title: "Shared Pool",
          description: "Snapshot share",
          tierLabels: {
            S: "神作",
            A: "A",
            B: "B",
            C: "C",
            D: "D"
          },
          snapshot: {
            version: 1,
            generatedAt: "2026-06-11T12:00:00.000Z",
            pool: { id: "pool-1", name: "Shared Pool" },
            run: { id: "run-1" },
            creator: {
              id: "user-1",
              displayName: "zaoc",
              username: "zaoc"
            },
            tiers: [
              {
                key: "S",
                label: "神作",
                items: [
                  {
                    animeId: "anime-1",
                    title: "Custom Upload",
                    coverUrl: "/uploads/custom-items/item.png",
                    source: "CUSTOM_UPLOAD",
                    animeType: "IMAGE"
                  }
                ]
              },
              { key: "A", label: "A", items: [] },
              { key: "B", label: "B", items: [] },
              { key: "C", label: "C", items: [] },
              { key: "D", label: "D", items: [] }
            ],
            animeCount: 1,
            comparisonCount: 5
          },
          createdAt: "2026-06-11T12:00:00.000Z"
        }
      })
    );

    expect(html).toContain("Shared Pool");
    expect(html).toContain('href="/u/zaoc"');
    expect(html).toContain(">zaoc<");
    expect(html).toContain("制作这套 Tier List");
    expect(html).toContain("神作");
    expect(html).toContain("Custom Upload");
    expect(html).toContain("/uploads/custom-items/item.png");
    expect(html).toContain("复制链接");
    expect(html).toContain("返回 AniMatch 首页");
    expect(html).not.toContain("编辑最终设定");
    expect(html).not.toContain("继续对决");
    expect(html).not.toContain("校准榜单");
    expect(html).not.toContain("恢复系统排序");
  });

  it("renders a friendly missing-share page", () => {
    const html = renderToStaticMarkup(React.createElement(TierShareMissingView));

    expect(html).toContain("这个分享榜单不存在或已被删除。");
    expect(html).toContain("返回 AniMatch 首页");
  });

  it("renders share creation errors without hiding tier content", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(TierSharePanel, {
          shareError: "分享链接生成失败：Pool not found",
          shareUrl: null,
          shareCopied: false,
          onCopyShareUrl: () => undefined
        }),
        React.createElement(TierShareView, {
          share: shareFixture()
        })
      )
    );

    expect(html).toContain("分享链接生成失败：Pool not found");
    expect(html).toContain("Shared Pool");
    expect(html).toContain("Custom Upload");
    expect(html).not.toContain("这个分享榜单不存在或已被删除。");
  });

  it("renders snapshot items without a cover url using the fallback card", () => {
    const share = shareFixture();
    share.snapshot.tiers[0].items[0].coverUrl = undefined;

    const html = renderToStaticMarkup(React.createElement(TierShareView, { share }));

    expect(html).not.toContain("<img");
    expect(html).toContain("Custom Upload");
  });

  it("export mode selects image variants when coverUrl is absent", () => {
    const share = shareFixture();
    share.snapshot.tiers[0].items[0] = {
      animeId: "anime-1",
      title: "TierMaker Image",
      coverUrl: null,
      imageUrl: "https://cdn.tiermaker.com/images/item.png",
      imageMediumUrl: "https://cdn.tiermaker.com/images/item-medium.png",
      imageLargeUrl: "https://cdn.tiermaker.com/images/item-large.png",
      thumbnailUrl: "https://cdn.tiermaker.com/images/item-thumb.png",
      source: "TIERMAKER_IMPORT",
      animeType: "IMAGE"
    };

    const html = renderToStaticMarkup(
      React.createElement(TierShareView, { share, exportMode: true })
    );

    expect(html).toContain("<img");
    expect(html).toContain(
      "/api/image-proxy?url=https%3A%2F%2Fcdn.tiermaker.com%2Fimages%2Fitem-large.png"
    );
    expect(html).toContain("Shared Pool");
    expect(html).toContain('href="/u/zaoc"');
    expect(html).toContain(">zaoc<");
    expect(html).not.toContain(">TIERMAKER_IMPORT<");
  });

  it("noisy titles do not affect export image src", () => {
    const share = shareFixture();
    share.snapshot.tiers[0].items[0] = {
      animeId: "anime-1",
      title: "zzzzz 17750273769085f154 f2a3b4c5d6e7f8",
      imageUrl: "https://cdn.tiermaker.com/images/noisy-title-item.png",
      source: "TIERMAKER_IMPORT",
      animeType: "IMAGE"
    };

    const html = renderToStaticMarkup(
      React.createElement(TierShareView, { share, exportMode: true })
    );

    expect(html).toContain(
      "/api/image-proxy?url=https%3A%2F%2Fcdn.tiermaker.com%2Fimages%2Fnoisy-title-item.png"
    );
    expect(html).toContain("未命名作品");
    expect(html).not.toContain(">TIERMAKER_IMPORT<");
    expect(html).not.toContain("17750273769085f154");
  });

  it("uses imported image display rules for shared TierMaker items", () => {
    const share = shareFixture();
    share.snapshot.tiers[0].items[0] = {
      animeId: "anime-1",
      title: "zzzzz 17750273769085f154 f2a3b4c5d6e7f8",
      coverUrl: "http://tiermaker.example/item.png",
      source: "TIERMAKER_IMPORT",
      animeType: "IMAGE"
    };

    const html = renderToStaticMarkup(React.createElement(TierShareView, { share }));

    expect(html).toContain("未命名作品");
    expect(html).not.toContain("17750273769085f154");
    expect(html).toContain('data-cover-fit="contain"');
    expect(html).not.toContain(">TIERMAKER_IMPORT<");
  });
});

function shareFixture(): PublicTierShare {
  return {
    token: "token-1",
    title: "Shared Pool",
    description: "Snapshot share",
    tierLabels: {
      S: "神作",
      A: "A",
      B: "B",
      C: "C",
      D: "D"
    },
    snapshot: {
      version: 1 as const,
      generatedAt: "2026-06-11T12:00:00.000Z",
      pool: { id: "pool-1", name: "Shared Pool" },
      run: { id: "run-1" },
      creator: {
        id: "user-1",
        displayName: "zaoc",
        username: "zaoc"
      },
      tiers: [
        {
          key: "S" as const,
          label: "神作",
          items: [
            {
              animeId: "anime-1",
              title: "Custom Upload",
              coverUrl: "/uploads/custom-items/item.png",
              source: "CUSTOM_UPLOAD",
              animeType: "IMAGE"
            }
          ]
        },
        { key: "A" as const, label: "A", items: [] },
        { key: "B" as const, label: "B", items: [] },
        { key: "C" as const, label: "C", items: [] },
        { key: "D" as const, label: "D", items: [] }
      ],
      animeCount: 1,
      comparisonCount: 5
    },
    createdAt: "2026-06-11T12:00:00.000Z"
  };
}
