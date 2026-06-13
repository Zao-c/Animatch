import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { GET } from "../src/app/api/dashboard/route";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null }))
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findMany: vi.fn()
    }
  }
}));

const mockedCustomPool = vi.mocked(prisma.customPool);

function pool(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    creatorId: "user-1",
    name: "Pool",
    description: null,
    coverUrl: null,
    visibility: Visibility.PRIVATE,
    status: PoolStatus.DRAFT,
    tags: [],
    sourcePoolId: null,
    affectsGlobalTaste: true,
    cloneCount: 0,
    useCount: 0,
    likeCount: 0,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    poolAnime: [],
    personalRuns: [],
    ...overrides
  };
}

function entry(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `entry-${index}`,
    poolId: "pool-1",
    animeId: `anime-${index}`,
    position: index,
    anime: {
      id: `anime-${index}`,
      title: `Anime ${index}`,
      titleCn: `鍔ㄧ敾 ${index}`,
      imageUrl: `https://img.example.test/${index}.jpg`,
      thumbnailUrl: null,
      imageSmallUrl: null,
      imageMediumUrl: null,
      imageLargeUrl: null,
      year: 2024,
      animeType: "TV",
      ...overrides
    }
  };
}

describe("GET /api/dashboard miniMatchPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns real preview pairs for a continue run", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool({
        poolAnime: [entry(1), entry(2), entry(3), entry(4)],
        personalRuns: [{ id: "run-1" }]
      })
    ] as any);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.miniMatchPreview).toMatchObject({
      source: "CONTINUE_RUN",
      poolId: "pool-1",
      runId: "run-1",
      ctaHref: "/pools/pool-1/runs/run-1/match",    });
    expect(payload.data.miniMatchPreview.pairs).toHaveLength(2);
    expect(payload.data.miniMatchPreview.pairs[0].left.title).toBe("Anime 1");
    expect(payload.data.miniMatchPreview.pairs[0].right.imageUrl).toBe("https://img.example.test/2.jpg");
  });

  it("uses only current active PoolAnime entries for preview pairs", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool({
        poolAnime: [entry(1), entry(3)],
        personalRuns: [{ id: "run-1" }]
      })
    ] as any);

    const response = await GET();
    const payload = await response.json();

    expect(payload.data.miniMatchPreview.pairs).toHaveLength(1);
    expect(JSON.stringify(payload.data.miniMatchPreview)).not.toContain("anime-2");
  });

  it("returns EMPTY when no real preview data exists", async () => {
    mockedCustomPool.findMany.mockResolvedValue([]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.miniMatchPreview).toEqual({
      source: "EMPTY",
      ctaLabel: "体验示例番组",
      pairs: []
    });
  });
});
