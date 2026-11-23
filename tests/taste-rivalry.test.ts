import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db";
import { choosePublicRivalry, getPublicTasteRivalry } from "../src/lib/taste-rivalry";
import type { TasteEntry } from "../src/lib/taste-analysis";

vi.mock("../src/lib/db", () => ({ prisma: {
  customPool: { findUnique: vi.fn() }, battleSeason: { findUnique: vi.fn() },
  userPoolScore: { groupBy: vi.fn(), findMany: vi.fn() },
  battleSeasonUserScore: { groupBy: vi.fn(), findMany: vi.fn() },
  poolAnime: { findMany: vi.fn() }
} }));

beforeEach(() => vi.clearAllMocks());

describe("public taste rivalry", () => {
  const ratings = [1800, 1750, 1700, 1400, 1350, 1300];
  const entries = (reverse = false): TasteEntry[] => ratings.map((_, index) => ({
    animeId: `anime${index}`, title: `作品${index}`, imageUrl: null, tags: [],
    score: reverse ? ratings[ratings.length - 1 - index] : ratings[index]
  }));

  it("requires multiple high-versus-low works before naming a public pair", () => {
    const pair = choosePublicRivalry([
      { username: "甲", name: "甲", entries: entries() },
      { username: "乙", name: "乙", entries: entries(true) }
    ]);
    expect(pair).toMatchObject({ left: { username: "甲" }, right: { username: "乙" }, commonCount: 6 });
    expect(pair?.conflictCount).toBeGreaterThanOrEqual(3);
    expect(pair?.examples.length).toBeLessThanOrEqual(5);
    expect(choosePublicRivalry([
      { username: "甲", name: "甲", entries: entries() },
      { username: "乙", name: "乙", entries: entries() }
    ])).toBeNull();
  });

  it("does not expose a private pool through the public rivalry endpoint", async () => {
    vi.mocked(prisma.customPool.findUnique).mockResolvedValue({ id: "private", name: "私有番组", visibility: "PRIVATE", deletedAt: null } as any);
    await expect(getPublicTasteRivalry("pool:private")).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.userPoolScore.groupBy).not.toHaveBeenCalled();
  });

  it("does not invent a rivalry without enough participants", async () => {
    vi.mocked(prisma.customPool.findUnique).mockResolvedValue({ id: "public", name: "公开番组", visibility: "PUBLIC", deletedAt: null } as any);
    vi.mocked(prisma.userPoolScore.groupBy).mockResolvedValue([]);
    expect(await getPublicTasteRivalry("pool:public")).toMatchObject({ participantCount: 0, pair: null });
  });
});
