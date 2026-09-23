import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db";
import { getTasteProfile, findTasteMatches } from "../src/lib/taste-service";
import { getCollection, saveCollection, validateCollectionInput, createAnnualFinal } from "../src/lib/collection-service";
import { archiveCommunity, archivedSeasonRanking, type SeasonArchiveData } from "../src/lib/season-archive";

vi.mock("../src/lib/db", () => ({ prisma: {
  user: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
  animeCollection: { findFirst: vi.fn() }, battleSeason: { findMany: vi.fn() },
  userPoolScore: { findMany: vi.fn() }, battleSeasonUserScore: { findMany: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn()
} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
});

describe("taste privacy", () => {
  it("does not query private taste records when visiting a profile without opt-in", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "owner", tasteProfilePublic: false, allowTasteMatching: false, profileVisibility: "PUBLIC" } as any);
    expect(await getTasteProfile("owner", "visitor")).toMatchObject({ visible: false, profile: null, scopes: [] });
    expect(prisma.userPoolScore.findMany).not.toHaveBeenCalled();
  });
  it("respects private profile visibility even after opting into taste", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "owner", tasteProfilePublic: true, allowTasteMatching: true, profileVisibility: "PRIVATE" } as any);
    expect(await getTasteProfile("owner", "visitor")).toMatchObject({ visible: false });
  });
  it("immediately blocks matching when consent is withdrawn", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ allowTasteMatching: false, tasteProfilePublic: true, profileVisibility: "PUBLIC" } as any);
    await expect(findTasteMatches("owner", "pool:any")).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.userPoolScore.findMany).not.toHaveBeenCalled();
  });
});

describe("collection ownership and validation", () => {
  const input = { title: "年度", year: 2026, sources: [{ seasonId: "s1", quarter: 1, phase: "OPENING" }] };
  it("rejects duplicate slots and duplicate seasons", () => {
    expect(() => validateCollectionInput({ ...input, sources: [...input.sources, ...input.sources] })).toThrow();
    expect(() => validateCollectionInput({ ...input, sources: [{ seasonId: "s1", quarter: 5, phase: "ENDING" }] })).toThrow();
    expect(() => validateCollectionInput({ ...input, year: 2026.5 })).toThrow();
    expect(() => validateCollectionInput({ ...input, sources: [] })).toThrow();
  });
  it("cannot read someone else's collection", async () => {
    vi.mocked(prisma.animeCollection.findFirst).mockResolvedValue(null);
    await expect(getCollection("visitor", "collection")).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.animeCollection.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "collection", ownerId: "visitor" } }));
  });
  it("rejects a private source belonging to another user", async () => {
    vi.mocked(prisma.battleSeason.findMany).mockResolvedValue([{ id: "s1", poolId: "p1", pool: { creatorId: "other", deletedAt: null, visibility: "PRIVATE" } }] as any);
    await expect(saveCollection("owner", input)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("returns an existing final on retry instead of making another pool", async () => {
    vi.mocked(prisma.animeCollection.findFirst).mockResolvedValue({ id: "c1", ownerId: "owner", finalPoolId: "final1" } as any);
    expect(await createAnnualFinal("owner", "c1")).toEqual({ poolId: "final1" });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});

describe("frozen season results", () => {
  it("preserves the existing Elo rule and keeps bias out of independent headcount", () => {
    const data: SeasonArchiveData = { items: [{ animeId: "a", title: "动画", imageUrl: null, tags: [], score: 1500 }], scores: [0, 1, 2].map((i) => ({ userId: `u${i}`, animeId: "a", score: 1700, count: 5, bias: i === 0 ? 1 : 0, wins: 3, losses: 2, uncertainty: 80 })) };
    const result = archivedSeasonRanking(data)[0];
    expect(result.participantCount).toBe(3);
    expect(result.score).toBeCloseTo((4500 + 1700 * 3.5) / 6.5);
    expect(archiveCommunity(data)[0].score).toBeCloseTo(result.score);
    expect(result.insufficientSample).toBe(false);
  });
});
