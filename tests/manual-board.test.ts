import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { buildManualBoardShare, moveBoardItem, validateManualBoard, type ManualBoardData } from "../src/lib/manual-board";
import { getManualBoard, getSharedManualBoard, revokeManualBoardShare, saveManualBoard } from "../src/lib/manual-board-service";
import { DEFAULT_TIER_CONFIG } from "../src/lib/tier-config";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { TierShareCard } from "../src/components/TierShareView";

vi.mock("../src/lib/db", () => ({ prisma: {
  customPool: { findUnique: vi.fn() },
  manualTierBoard: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() }
} }));
vi.mock("../src/lib/anime-display", async (original) => ({ ...(await original<object>()),
  getEffectiveAnimeDisplay: (entry: any) => ({ title: entry.anime.title, coverUrl: entry.anime.cachedCoverUrl, animeType: "TV" })
}));

function fixture(): ManualBoardData {
  return { pool: { id: "pool", name: "番组" }, title: "我的榜单", revision: 0, shareUrl: null,
    layout: { rows: DEFAULT_TIER_CONFIG.rows, tiers: { s: ["a", "b"], a: [], b: [], c: [], d: [] } },
    items: ["a", "b", "c"].map((id) => ({ animeId: id, title: id, coverUrl: "/cover.png", source: "BANGUMI" })) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.customPool.findUnique).mockResolvedValue({ id: "pool", name: "番组", creatorId: "owner", visibility: "PUBLIC", deletedAt: null,
    poolAnime: fixture().items.map((item) => ({ animeId: item.animeId, anime: { title: item.title, cachedCoverUrl: item.coverUrl, imageUrl: "https://source.example/original.png", source: "BANGUMI" } }))
  } as any);
  vi.mocked(prisma.manualTierBoard.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.manualTierBoard.updateMany).mockResolvedValue({ count: 1 });
});

describe("free tier board layout", () => {
  it("moves across rows without duplicating items, supports same-row ordering and unranking", () => {
    const original = fixture().layout;
    const reordered = moveBoardItem(original, "b", "s", "a");
    expect(reordered.tiers.s).toEqual(["b", "a"]);
    expect(original.tiers.s).toEqual(["a", "b"]);
    const moved = moveBoardItem(reordered, "a", "b");
    expect(moved.tiers.s).toEqual(["b"]);
    expect(moved.tiers.b).toEqual(["a"]);
    expect(Object.values(moveBoardItem(moved, "a").tiers).flat()).toEqual(["b"]);
  });
  it("rejects duplicate items, foreign items, invalid rows and invalid revisions", () => {
    const board = fixture();
    const allowed = new Set(["a", "b", "c"]);
    expect(validateManualBoard(board, allowed).layout.tiers.s).toEqual(["a", "b"]);
    expect(() => validateManualBoard({ ...board, revision: -1 }, allowed)).toThrow("版本");
    expect(() => validateManualBoard({ ...board, layout: { ...board.layout, tiers: { ...board.layout.tiers, a: ["a"] } } }, allowed)).toThrow("重复");
    expect(() => validateManualBoard({ ...board, layout: { ...board.layout, tiers: { ...board.layout.tiers, a: ["foreign"] } } }, allowed)).toThrow("移出");
    expect(() => validateManualBoard({ ...board, layout: { ...board.layout, rows: [] } }, allowed)).toThrow();
  });
  it("exports only ranked items, retaining the image sources and manual label", () => {
    const board = fixture();
    board.items[0].imageLargeUrl = "https://source.example/a.jpg";
    const share = buildManualBoardShare(board);
    expect(share.snapshot.animeCount).toBe(2);
    expect(share.snapshot.tiers.flatMap((tier) => tier.items).map((item) => item.animeId)).toEqual(["a", "b"]);
    const html = renderToStaticMarkup(React.createElement(TierShareCard, { share, exportMode: true }));
    expect(html).toContain("自由排榜");
    expect(html).toContain("https://source.example/a.jpg");
    expect(html).not.toContain("0 对决");
    expect(html).not.toContain("初始预览");
  });
});

describe("manual board persistence and access", () => {
  it("starts with every item unranked without creating a run or scores", async () => {
    const board = await getManualBoard("visitor", "pool");
    expect(board.revision).toBe(0);
    expect(Object.values(board.layout.tiers).flat()).toEqual([]);
    expect(board.items).toHaveLength(3);
    expect(prisma.manualTierBoard.create).not.toHaveBeenCalled();
  });
  it("rejects another user's private pool before reading a board", async () => {
    vi.mocked(prisma.customPool.findUnique).mockResolvedValue({ creatorId: "owner", visibility: "PRIVATE", deletedAt: null } as any);
    await expect(getManualBoard("visitor", "pool")).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.manualTierBoard.findUnique).not.toHaveBeenCalled();
  });
  it("creates private drafts without publishing anything", async () => {
    await saveManualBoard("owner", "pool", fixture());
    const args = vi.mocked(prisma.manualTierBoard.create).mock.calls[0][0];
    expect(args.data).toMatchObject({ ownerId: "owner", poolId: "pool" });
    expect(args.data).not.toHaveProperty("shareToken");
    expect(args.data).not.toHaveProperty("sharedSnapshot");
  });
  it("publishes a server-built snapshot with actual pool items", async () => {
    await saveManualBoard("owner", "pool", { ...fixture(), items: [{ animeId: "fake", title: "fake" }] }, true);
    const data = vi.mocked(prisma.manualTierBoard.create).mock.calls[0][0].data;
    expect(data.shareToken).toMatch(/^[a-f0-9]{32}$/);
    expect((data.sharedSnapshot as any).snapshot.tiers[0].items.map((item: any) => item.animeId)).toEqual(["a", "b"]);
  });
  it("does not update a public snapshot when only saving a draft", async () => {
    vi.mocked(prisma.manualTierBoard.findUnique).mockResolvedValue({ title: "old", layout: fixture().layout, revision: 2, shareToken: "published" } as any);
    await saveManualBoard("owner", "pool", { ...fixture(), revision: 2 });
    const data = vi.mocked(prisma.manualTierBoard.updateMany).mock.calls[0][0].data;
    expect(data).not.toHaveProperty("sharedSnapshot");
    expect(data).not.toHaveProperty("shareToken");
  });
  it("detects stale revisions and races instead of silently overwriting", async () => {
    vi.mocked(prisma.manualTierBoard.findUnique).mockResolvedValue({ title: "old", layout: fixture().layout, revision: 2 } as any);
    await expect(saveManualBoard("owner", "pool", fixture())).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.manualTierBoard.updateMany).not.toHaveBeenCalled();
    vi.mocked(prisma.manualTierBoard.updateMany).mockResolvedValue({ count: 0 });
    await expect(saveManualBoard("owner", "pool", { ...fixture(), revision: 2 })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("revokes only this owner's share and invalidates outstanding edits", async () => {
    vi.mocked(prisma.manualTierBoard.findUnique).mockResolvedValue({ title: "old", layout: fixture().layout, revision: 2 } as any);
    await expect(revokeManualBoardShare("owner", "pool", 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.manualTierBoard.updateMany).not.toHaveBeenCalled();
    await revokeManualBoardShare("owner", "pool", 2);
    expect(prisma.manualTierBoard.updateMany).toHaveBeenCalledWith({ where: { ownerId: "owner", poolId: "pool", revision: 2 }, data: {
      shareToken: null, sharedSnapshot: Prisma.DbNull, revision: { increment: 1 }
    } });
  });
  it("keeps deleted users' or pools' published snapshots unavailable", async () => {
    vi.mocked(prisma.manualTierBoard.findUnique).mockResolvedValue({ owner: { deletedAt: new Date() }, pool: { deletedAt: null }, sharedSnapshot: buildManualBoardShare(fixture()) } as any);
    expect(await getSharedManualBoard("token")).toBeNull();
    vi.mocked(prisma.manualTierBoard.findUnique).mockResolvedValue(null);
    expect(await getSharedManualBoard("revoked-token")).toBeNull();
  });
});
