import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { TierShareMissingView, TierShareView } from "../src/components/TierShareView";

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
            ]
          },
          createdAt: "2026-06-11T12:00:00.000Z"
        }
      })
    );

    expect(html).toContain("Shared Pool");
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
});
