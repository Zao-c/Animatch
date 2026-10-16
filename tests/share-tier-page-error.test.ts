import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/app-error";
import type { PublicTierShare } from "../src/lib/client-api";

const mocks = vi.hoisted(() => ({ getPublicTierShare: vi.fn() }));

vi.mock("@/lib/tier-share-service", () => ({
  getPublicTierShare: mocks.getPublicTierShare,
}));

import ShareTierPage from "../src/app/share/tier/[token]/page";

function shareFixture(): PublicTierShare {
  return {
    token: "token-1",
    title: "Shared Pool",
    description: null,
    tierLabels: { S: "神作", A: "A", B: "B", C: "C", D: "D" },
    snapshot: {
      version: 1,
      generatedAt: "2026-06-11T12:00:00.000Z",
      pool: { id: "pool-1", name: "Shared Pool" },
      run: { id: "run-1" },
      creator: { id: "user-1", displayName: "zaoc", username: "zaoc" },
      tiers: [
        { key: "S", label: "神作", items: [] },
        { key: "A", label: "A", items: [] },
        { key: "B", label: "B", items: [] },
        { key: "C", label: "C", items: [] },
        { key: "D", label: "D", items: [] },
      ],
      animeCount: 0,
      comparisonCount: 0,
    },
    createdAt: "2026-06-11T12:00:00.000Z",
  };
}

describe("ShareTierPage error classification", () => {
  beforeEach(() => {
    mocks.getPublicTierShare.mockReset();
  });

  it("renders the share when it exists", async () => {
    mocks.getPublicTierShare.mockResolvedValue(shareFixture());

    const element = await ShareTierPage({ params: { token: "token-1" }, searchParams: {} });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Shared Pool");
    expect(html).not.toContain("这个分享榜单不存在或已被删除。");
    expect(html).not.toContain("这个分享榜单暂时无法加载。");
  });

  it("only reports a deleted share for a genuine not-found", async () => {
    mocks.getPublicTierShare.mockRejectedValue(
      new AppError("Tier share not found", 404, "TIER_SHARE_NOT_FOUND")
    );

    const element = await ShareTierPage({ params: { token: "gone" }, searchParams: {} });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("这个分享榜单不存在或已被删除。");
    expect(html).not.toContain("这个分享榜单暂时无法加载。");
  });

  it("does not claim a share was deleted when loading fails unexpectedly", async () => {
    mocks.getPublicTierShare.mockRejectedValue(new Error("database is unreachable"));

    const element = await ShareTierPage({ params: { token: "token-1" }, searchParams: {} });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("这个分享榜单暂时无法加载。");
    expect(html).not.toContain("这个分享榜单不存在或已被删除。");
  });
});
