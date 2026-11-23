import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTierShareVersion } from "../src/lib/tier-share-version";
import { TierSharePanel } from "../src/components/TierSharePanel";
import type { TierListItem } from "../src/lib/tier-service";

function state(): Parameters<typeof createTierShareVersion>[0] {
  const item = { animeId: "anime-1", title: "作品", eloScore: 1500, manualTier: null } as TierListItem;
  return {
    tierRows: [{ id: "s", label: "S", color: "#ff747c", order: 0 }, { id: "a", label: "A", color: "#ffc078", order: 1 }],
    tiers: { s: [item, { ...item, animeId: "anime-2" }], a: [] },
    totalAnime: 2, comparedAnime: 2, totalComparisons: 4, effectiveComparisons: 3
  };
}

describe("share ranking version", () => {
  it("is stable across serialization and tier dictionary insertion order", () => {
    const initial = state();
    const reordered = { ...initial, tiers: { a: initial.tiers.a, s: initial.tiers.s } };
    expect(createTierShareVersion(reordered)).toBe(createTierShareVersion(JSON.parse(JSON.stringify(initial))));
  });

  it("detects other-tab votes even when no manual tier changed", () => {
    const initial = state();
    const changed = structuredClone(initial);
    changed.tiers.s[0].eloScore += 10;
    changed.effectiveComparisons += 1;
    expect(changed.tiers.s[0].manualTier).toBe(initial.tiers.s[0].manualTier);
    expect(createTierShareVersion(changed)).not.toBe(createTierShareVersion(initial));
  });

  it("detects changed ordering and edited row configuration", () => {
    const initial = state();
    const reordered = structuredClone(initial);
    reordered.tiers.s.reverse();
    expect(createTierShareVersion(reordered)).not.toBe(createTierShareVersion(initial));
    const relabeled = structuredClone(initial);
    relabeled.tierRows[0].label = "神作";
    expect(createTierShareVersion(relabeled)).not.toBe(createTierShareVersion(initial));
  });

  it("detects changed display content and visible works", () => {
    const initial = state();
    const renamed = structuredClone(initial);
    renamed.tiers.s[0].title = "新标题";
    expect(createTierShareVersion(renamed)).not.toBe(createTierShareVersion(initial));
    const removed = structuredClone(initial);
    removed.tiers.s.pop();
    expect(createTierShareVersion(removed)).not.toBe(createTierShareVersion(initial));
  });
});

describe("published snapshot feedback", () => {
  const props = {
    shareUrl: "https://example.com/share/tier/one", shareError: null, shareCopied: false,
    onCopyShareUrl: () => undefined, createdAt: "2026-10-27T00:00:00.000Z"
  };

  it("shows the fixed snapshot's creation time without suggesting it tracks later edits", () => {
    const html = renderToStaticMarkup(React.createElement(TierSharePanel, props));
    expect(html).toContain('dateTime="2026-10-27T00:00:00.000Z"');
    expect(html).toContain("之后的编辑不会更新这个链接");
  });

  it("labels an older link and offers an explicit action to create a current snapshot", () => {
    const html = renderToStaticMarkup(React.createElement(TierSharePanel, {
      ...props, isOutdated: true, onCreateNewShare: () => undefined
    }));
    expect(html).toContain("此链接仍保留生成时的内容");
    expect(html).toContain("复制之前的链接");
    expect(html).toContain("按当前榜单重新生成");
  });
});
