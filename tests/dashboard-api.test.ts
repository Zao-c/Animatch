import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { GET } from "../src/app/api/dashboard/route";
import { prisma } from "../src/lib/db";
import { getOrCreateOfficialDemoPool } from "../src/lib/demo-pool";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null }))
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

vi.mock("../src/lib/demo-pool", () => ({
  getOrCreateOfficialDemoPool: vi.fn()
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedGetOrCreateOfficialDemoPool = vi.mocked(getOrCreateOfficialDemoPool);

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
    mockedGetOrCreateOfficialDemoPool.mockResolvedValue({
      poolId: "official-demo",
      created: false,
      animeCount: 4,
      redirectTo: "/pools/official-demo",
      isOfficialDemo: true
    });
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

  it("falls back to the official demo preview when no continue run exists", async () => {
    mockedCustomPool.findMany.mockResolvedValue([]);
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        id: "official-demo",
        visibility: Visibility.PUBLIC,
        poolAnime: [entry(1), entry(2), entry(3), entry(4)]
      }) as any
    );

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.miniMatchPreview).toMatchObject({
      source: "DEMO_POOL",
      poolId: "official-demo",
      ctaHref: "/pools/official-demo",
      ctaLabel: "体验示例番组"
    });
    expect(payload.data.miniMatchPreview.pairs).toHaveLength(2);
  });
});
