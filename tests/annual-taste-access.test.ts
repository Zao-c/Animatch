import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/db";
import { getTasteProfile, findTasteMatches } from "../src/lib/taste-service";
import { PATCH as updateTasteSettings } from "../src/app/api/taste/settings/route";
import { getCollection, saveCollection, validateCollectionInput, createAnnualFinal } from "../src/lib/collection-service";
import { archiveCommunity, archivedSeasonRanking, type SeasonArchiveData } from "../src/lib/season-archive";

vi.mock("../src/lib/db", () => ({ prisma: {
  user: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
  animeCollection: { findFirst: vi.fn() }, battleSeason: { findMany: vi.fn() },
  userPoolScore: { findMany: vi.fn(), groupBy: vi.fn() }, battleSeasonUserScore: { findMany: vi.fn(), groupBy: vi.fn() },
  poolAnime: { findMany: vi.fn() },
  userAnimeStatus: { findMany: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn()
} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.userPoolScore.findMany).mockResolvedValue([]);
  vi.mocked(prisma.battleSeasonUserScore.findMany).mockResolvedValue([]);
  vi.mocked(prisma.poolAnime.findMany).mockResolvedValue([]);
  vi.mocked(prisma.userAnimeStatus.findMany).mockResolvedValue([]);
});

describe("automatic taste profiles", () => {
  it("retires the old opt-in API instead of silently saving an ineffective choice", async () => {
    const response = await updateTasteSettings();
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ ok: false });
  });
  it("shows public-pool taste records without an opt-in setting", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "owner", tasteProfilePublic: false, allowTasteMatching: false, profileVisibility: "PUBLIC" } as any);
    expect(await getTasteProfile("owner", "visitor")).toMatchObject({ visible: true, profile: { animeCount: 0 }, scopes: [] });
    expect(prisma.userPoolScore.findMany).toHaveBeenCalled();
  });
  it("does not apply the old profile visibility switch to public-pool taste", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "owner", tasteProfilePublic: true, allowTasteMatching: true, profileVisibility: "PRIVATE" } as any);
    expect(await getTasteProfile("owner", "visitor")).toMatchObject({ visible: true });
  });
  it("still rejects a scope the current user did not participate in", async () => {
    await expect(findTasteMatches("owner", "pool:any")).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.userPoolScore.findMany).toHaveBeenCalled();
  });
  it("matches users without opt-in and shows relative disagreement even when all are similar", async () => {
    const animes = Array.from({ length: 6 }, (_, index) => ({ id: `anime${index}`, title: `作品${index}`, tags: [], deletedAt: null }));
    const mine = animes.map((anime, index) => ({ poolId: "pool1", userId: "owner", animeId: anime.id, anime,
      pool: { name: "7月新番" }, eloScore: 1600 - index * 100 }));
    const bonus = { id: "bonus", title: "值得试试的新番", tags: [], deletedAt: null };
    const candidateRows = [
      ...animes.map((anime, index) => ({ poolId: "pool1", userId: "near", animeId: anime.id, anime,
        user: { username: "朋友甲", name: "朋友甲" }, eloScore: 1600 - index * 100 })),
      { poolId: "pool1", userId: "near", animeId: bonus.id, anime: bonus,
        user: { username: "朋友甲", name: "朋友甲" }, eloScore: 1900 },
      ...animes.map((anime, index) => ({ poolId: "pool1", userId: "lessNear", animeId: anime.id, anime,
        user: { username: "朋友乙", name: "朋友乙" }, eloScore: 1600 - (index === 0 ? 1 : index === 1 ? 0 : index) * 100 }))
    ];
    vi.mocked(prisma.userPoolScore.findMany).mockResolvedValueOnce(mine as any).mockResolvedValueOnce(candidateRows as any);
    vi.mocked(prisma.poolAnime.findMany).mockResolvedValue([...animes, bonus].map((anime) => ({ poolId: "pool1", animeId: anime.id })) as any);
    vi.mocked(prisma.userAnimeStatus.findMany).mockResolvedValue([{ animeId: bonus.id, status: "UNSEEN" }] as any);
    vi.mocked(prisma.userPoolScore.groupBy).mockResolvedValue([
      { userId: "near", _count: { animeId: 6 } }, { userId: "lessNear", _count: { animeId: 6 } }
    ] as any);

    const result = await findTasteMatches("owner", "pool:pool1");
    expect(result.candidateCount).toBe(2);
    expect(result.closest.map((item) => item.username)).toEqual(["朋友甲"]);
    expect(result.furthest.map((item) => item.username)).toEqual(["朋友乙"]);
    expect(result.furthest[0].similarity).toBeGreaterThan(50);
    expect(result.closest[0].recommendations).toEqual([expect.objectContaining({ animeId: "bonus", markedUnseen: true })]);
    expect(prisma.user.findUniqueOrThrow).not.toHaveBeenCalled();

    // A work already rated in another (including private) pool is not "unseen".
    vi.mocked(prisma.userPoolScore.findMany).mockResolvedValueOnce(mine as any)
      .mockResolvedValueOnce(candidateRows as any)
      .mockResolvedValueOnce([{ animeId: bonus.id }] as any);
    const withPriorRating = await findTasteMatches("owner", "pool:pool1");
    expect(withPriorRating.closest[0].recommendations).toEqual([]);
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
