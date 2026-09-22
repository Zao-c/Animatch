import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TierShareCard } from "../src/components/TierShareView";
import type { PublicTierShare } from "../src/lib/client-api";

const cos = "https://karuta-1321249409.cos.ap-shanghai.myqcloud.com/animatch/covers/test.webp";
function render(coverUrl?: string) {
  const share: PublicTierShare = {
    token: "test", title: "测试榜单", description: null, tierLabels: { s: "S" },
    createdAt: "2026-09-21T00:00:00.000Z",
    snapshot: {
      version: 1, animeCount: 1, comparisonCount: 1, generatedAt: "2026-09-21T00:00:00.000Z", pool: { id: "test", name: "测试" },
      run: { id: "test" }, tiers: [{ key: "s", label: "S", items: [{ animeId: "a", title: "动画", coverUrl,
        imageLargeUrl: "https://lain.bgm.tv/old-large.jpg", source: "BANGUMI", elo: 1500, isLocked: false, isEdited: false }] }]
    }
  };
  return renderToStaticMarkup(React.createElement(TierShareCard, { share, exportMode: true }));
}

describe("snapshot cover priority", () => {
  it("preserves resolved COS and custom covers even when old large originals exist", () => {
    expect(render(cos)).toContain(`data-export-src="${cos}"`);
    expect(render("/uploads/anime-covers/custom.png")).toContain('data-export-src="/uploads/anime-covers/custom.png"');
    expect(render(cos)).not.toContain("old-large.jpg");
  });
  it("keeps legacy snapshots without resolved covers exportable", () => {
    expect(render()).toContain("old-large.jpg");
  });
});
