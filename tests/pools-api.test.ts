import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { DELETE, GET as GET_POOL, PATCH } from "../src/app/api/pools/[poolId]/route";
import { POST as RESTORE_POOL } from "../src/app/api/pools/[poolId]/restore/route";
import { GET as LIST_POOLS } from "../src/app/api/pools/route";
import { getCurrentUser, requireCurrentUser } from "../src/lib/auth-session";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null }))
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    poolAnime: {
      deleteMany: vi.fn()
    },
    personalRun: {
      deleteMany: vi.fn()
    },
    userPoolScore: {
      deleteMany: vi.fn()
    },
    poolComparison: {
      deleteMany: vi.fn()
    }
  },
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);
const mockedPersonalRun = vi.mocked(prisma.personalRun);
const mockedUserPoolScore = vi.mocked(prisma.userPoolScore);
const mockedPoolComparison = vi.mocked(prisma.poolComparison);
const mockedRequireCurrentUser = vi.mocked(requireCurrentUser);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);

function pool(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    creatorId: "user-1",
    name: "Original",
    description: "Original description",
    coverUrl: null,
    visibility: Visibility.PRIVATE,
    status: PoolStatus.DRAFT,
    tags: [],
    sourcePoolId: null,
    affectsGlobalTaste: true,
    allowPublicEdit: false,
    allowCommunityMatch: false,
    isOfficialDemo: false,
    tierConfig: null,
    cloneCount: 0,
    useCount: 0,
    likeCount: 0,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    poolAnime: [],
    personalRuns: [],
    _count: {
      poolAnime: 0,
      poolComparisons: 0
    },
    ...overrides,
  };
}

describe("pools API management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireCurrentUser.mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });
    mockedGetCurrentUser.mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });
  });

  it("GET /api/pools defaults to public pools when the user is not logged in", async () => {
    mockedGetCurrentUser.mockResolvedValueOnce(null);
    mockedCustomPool.findMany.mockResolvedValue([]);

    const response = await LIST_POOLS(new Request("http://test.local/api/pools"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items).toEqual([]);
    expect(mockedCustomPool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: Visibility.PUBLIC,
          deletedAt: null,
          status: { not: PoolStatus.ARCHIVED }
        })
      })
    );
  });

  it("PATCH updates pool metadata", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedCustomPool.update.mockResolvedValue(
      pool({
        name: "Updated",
        description: "Next description",
        visibility: Visibility.PUBLIC,
        tags: ["test"],
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Updated",
          description: "Next description",
          visibility: "PUBLIC",
          tags: ["test"],
        }),
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("Updated");
    expect(payload.data.visibility).toBe("PUBLIC");
    expect(mockedCustomPool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Updated",
          description: "Next description",
          visibility: "PUBLIC",
          tags: ["test"],
        }),
      })
    );
  });

  it("PATCH ignores reserved public permission fields", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedCustomPool.update.mockResolvedValue(
      pool({
        name: "Updated",
        visibility: Visibility.UNLISTED,
        allowPublicEdit: false,
        allowCommunityMatch: false
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Updated",
          description: "Next description",
          visibility: "UNLISTED",
          tags: ["test"],
          allowPublicEdit: true,
          allowCommunityMatch: true
        })
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(200);
    expect(mockedCustomPool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: "Updated",
          description: "Next description",
          visibility: "UNLISTED",
          tags: ["test"]
        }
      })
    );
  });

  it("PATCH returns 400 for empty name", async () => {
    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: " ",
          description: "Next description",
          visibility: "PUBLIC",
          tags: [],
        }),
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedCustomPool.update).not.toHaveBeenCalled();
  });

  it("PATCH rejects visibility updates from a non-owner", async () => {
    mockedRequireCurrentUser.mockResolvedValue({
      id: "user-2",
      username: "user-2",
      name: "User 2",
      image: null
    });
    mockedCustomPool.findUnique.mockResolvedValue(pool({ creatorId: "user-1" }));

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Updated",
          description: "Next description",
          visibility: "PUBLIC",
          tags: []
        })
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.message).toBe("你没有权限管理这个番组。");
    expect(mockedCustomPool.update).not.toHaveBeenCalled();
  });

  it("PATCH allows archived pools to edit metadata", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({ status: PoolStatus.ARCHIVED, deletedAt: new Date("2026-01-03T00:00:00.000Z") })
    );
    mockedCustomPool.update.mockResolvedValue(
      pool({
        name: "Archived display name",
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z")
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Archived display name",
          description: "Keep history",
          visibility: "PRIVATE",
          tags: []
        })
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(200);
    expect(mockedCustomPool.update).toHaveBeenCalled();
  });

  it("DELETE archives the pool without deleting related data", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedCustomPool.update.mockResolvedValue(
      pool({ status: PoolStatus.ARCHIVED, deletedAt: new Date("2026-01-03T00:00:00.000Z") })
    );

    const response = await DELETE(
      new Request("http://test.local/api/pools/pool-1", { method: "DELETE" }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({ ok: true });
    expect(mockedCustomPool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PoolStatus.ARCHIVED,
          deletedAt: expect.any(Date),
        }),
      })
    );
    expect(mockedPoolAnime.deleteMany).not.toHaveBeenCalled();
    expect(mockedPersonalRun.deleteMany).not.toHaveBeenCalled();
    expect(mockedUserPoolScore.deleteMany).not.toHaveBeenCalled();
    expect(mockedPoolComparison.deleteMany).not.toHaveBeenCalled();
  });

  it("POST restore makes an archived pool visible again", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({ status: PoolStatus.ARCHIVED, deletedAt: new Date("2026-01-03T00:00:00.000Z") })
    );
    mockedCustomPool.update.mockResolvedValue(pool({ status: PoolStatus.DRAFT, deletedAt: null }));

    const response = await RESTORE_POOL(
      new Request("http://test.local/api/pools/pool-1/restore", { method: "POST" }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.deletedAt).toBeNull();
    expect(mockedCustomPool.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: PoolStatus.DRAFT,
          deletedAt: null
        }
      })
    );
  });

  it("GET /api/pools hides archived pools by default", async () => {
    mockedCustomPool.findMany.mockResolvedValue([pool()]);

    const response = await LIST_POOLS(new Request("http://test.local/api/pools"));

    expect(response.status).toBe(200);
    expect(mockedCustomPool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creatorId: "user-1",
          deletedAt: null,
          status: { not: PoolStatus.ARCHIVED },
        }),
      })
    );
  });

  it("GET /api/pools?includeArchived=1 includes archived pools", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool(),
      pool({ id: "pool-2", status: PoolStatus.ARCHIVED, deletedAt: new Date() }),
    ]);

    const response = await LIST_POOLS(
      new Request("http://test.local/api/pools?includeArchived=1")
    );

    expect(response.status).toBe(200);
    expect(mockedCustomPool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          creatorId: "user-1",
        },
      })
    );
  });

  it("GET /api/pools applies q filtering and sort parameters", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool({
        id: "pool-small",
        name: "Beta",
        _count: { poolAnime: 1, poolComparisons: 0 }
      }),
      pool({
        id: "pool-large",
        name: "Alpha",
        _count: { poolAnime: 4, poolComparisons: 0 }
      })
    ]);

    const response = await LIST_POOLS(
      new Request("http://test.local/api/pools?q=test&sort=ANIME_COUNT")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedCustomPool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { name: { contains: "test", mode: "insensitive" } },
                { description: { contains: "test", mode: "insensitive" } }
              ]
            }
          ]
        })
      })
    );
    expect(payload.data.items.map((item: { id: string }) => item.id)).toEqual([
      "pool-large",
      "pool-small"
    ]);
  });

  it("GET /api/pools filters derived management statuses", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool({ id: "empty", _count: { poolAnime: 0, poolComparisons: 0 } }),
      pool({ id: "ready", _count: { poolAnime: 3, poolComparisons: 0 } }),
      pool({ id: "progress", _count: { poolAnime: 4, poolComparisons: 2 } }),
      pool({ id: "stable", _count: { poolAnime: 3, poolComparisons: 9 } })
    ]);

    const response = await LIST_POOLS(new Request("http://test.local/api/pools?status=STABLE"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0]).toMatchObject({
      id: "stable",
      uiStatus: "STABLE",
      animeCount: 3,
      comparisonCount: 9
    });
  });

  it("GET /api/pools exposes UI statuses for pool cards", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool({ id: "empty", _count: { poolAnime: 0, poolComparisons: 0 } }),
      pool({ id: "ready", _count: { poolAnime: 2, poolComparisons: 0 } }),
      pool({ id: "progress", _count: { poolAnime: 4, poolComparisons: 1 } }),
      pool({ id: "stable", _count: { poolAnime: 2, poolComparisons: 10 } }),
      pool({
        id: "archived",
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z"),
        _count: { poolAnime: 2, poolComparisons: 10 }
      })
    ]);

    const response = await LIST_POOLS(
      new Request("http://test.local/api/pools?includeArchived=1")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(
      payload.data.items.map((item: { uiStatus: string }) => item.uiStatus).sort()
    ).toEqual(["ARCHIVED", "EMPTY", "IN_PROGRESS", "READY", "STABLE"]);
    expect(
      payload.data.items.map((item: { uiStatusLabel: string }) => item.uiStatusLabel)
    ).not.toContain("???");
    expect(
      payload.data.items.map((item: { uiStatusLabel: string }) => item.uiStatusLabel)
    ).not.toContain("?????");
  });

  it("GET /api/pools returns the current visibility value for pool cards", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool({
        id: "public-pool",
        visibility: Visibility.PUBLIC,
        _count: { poolAnime: 2, poolComparisons: 0 }
      }),
      pool({
        id: "unlisted-pool",
        visibility: Visibility.UNLISTED,
        _count: { poolAnime: 2, poolComparisons: 0 }
      })
    ]);

    const response = await LIST_POOLS(new Request("http://test.local/api/pools"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items.map((item: { visibility: string }) => item.visibility)).toEqual([
      "PUBLIC",
      "UNLISTED"
    ]);
  });

  it("GET /api/pools displays TierMaker source labels for pool cards", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool({
        id: "tiermaker-pool",
        _count: { poolAnime: 2, poolComparisons: 0 },
        poolAnime: [
          { anime: { source: "TIERMAKER_IMPORT" } },
          { anime: { source: "TIERMAKER_IMPORT" } }
        ]
      })
    ]);

    const response = await LIST_POOLS(new Request("http://test.local/api/pools"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items[0]).toMatchObject({
      id: "tiermaker-pool",
      sourceType: "TierMaker"
    });
  });

  it("GET /api/pools returns cover preview images from active pool anime", async () => {
    mockedCustomPool.findMany.mockResolvedValue([
      pool({
        id: "cover-pool",
        _count: { poolAnime: 2, poolComparisons: 0 },
        poolAnime: [
          {
            anime: {
              source: "MANAMI",
              imageUrl: "https://img.example.test/a.jpg",
              thumbnailUrl: null,
              imageSmallUrl: null,
              imageMediumUrl: null,
              imageLargeUrl: null
            }
          },
          {
            anime: {
              source: "CUSTOM_UPLOAD",
              imageUrl: null,
              thumbnailUrl: "/uploads/custom-items/b.png",
              imageSmallUrl: null,
              imageMediumUrl: null,
              imageLargeUrl: null
            }
          }
        ]
      })
    ]);

    const response = await LIST_POOLS(new Request("http://test.local/api/pools"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items[0]).toMatchObject({
      id: "cover-pool",
      coverImages: ["https://img.example.test/a.jpg", "/uploads/custom-items/b.png"]
    });
  });

  it("GET pool detail still returns archived pools for history viewing", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({ status: PoolStatus.ARCHIVED, deletedAt: new Date() })
    );

    const response = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" },
    });

    expect(response.status).toBe(200);
  });

  it("GET pool detail returns a user-facing forbidden message for another user's pool", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "user-2",
      username: "user-2",
      name: "User 2",
      image: null
    });
    mockedCustomPool.findUnique.mockResolvedValue(pool());

    const response = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" },
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.message).toBe("你没有权限访问这个番组。");
    expect(payload.error.message).not.toContain("current dev user");
  });

  it("GET pool detail allows anonymous public reads after a pool is made public", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    mockedCustomPool.findUnique.mockResolvedValue(pool({ visibility: Visibility.PUBLIC }));

    const response = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.visibility).toBe("PUBLIC");
  });

  it("GET pool detail hides deleted public pools from non-owners", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "user-2",
      username: "user-2",
      name: "User 2",
      image: null
    });
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        visibility: Visibility.PUBLIC,
        deletedAt: new Date("2026-06-16T00:00:00.000Z")
      })
    );

    const response = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" }
    });

    expect(response.status).toBe(404);
  });

  it("GET pool detail keeps deleted pools readable for the owner", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        visibility: Visibility.PUBLIC,
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-06-16T00:00:00.000Z")
      })
    );

    const response = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" }
    });

    expect(response.status).toBe(200);
  });

  it("GET pool detail exposes manage permission only to the owner", async () => {
    mockedGetCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });
    mockedCustomPool.findUnique.mockResolvedValueOnce(pool({ visibility: Visibility.PUBLIC }));

    const ownerResponse = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" }
    });
    const ownerPayload = await ownerResponse.json();

    mockedGetCurrentUser.mockResolvedValueOnce({
      id: "user-2",
      username: "user-2",
      name: "User 2",
      image: null
    });
    mockedCustomPool.findUnique.mockResolvedValueOnce(pool({ visibility: Visibility.PUBLIC }));

    const nonOwnerResponse = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" }
    });
    const nonOwnerPayload = await nonOwnerResponse.json();

    mockedGetCurrentUser.mockResolvedValueOnce(null);
    mockedCustomPool.findUnique.mockResolvedValueOnce(pool({ visibility: Visibility.PUBLIC }));

    const anonymousResponse = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" }
    });
    const anonymousPayload = await anonymousResponse.json();

    expect(ownerPayload.data.permissions.canManage).toBe(true);
    expect(nonOwnerPayload.data.permissions.canManage).toBe(false);
    expect(anonymousPayload.data.permissions.canManage).toBe(false);
  });

  it("GET pool detail rejects anonymous and userB reads after a pool is made private", async () => {
    mockedGetCurrentUser.mockResolvedValueOnce(null);
    mockedCustomPool.findUnique.mockResolvedValue(pool({ visibility: Visibility.PRIVATE }));

    const anonymousResponse = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" }
    });

    mockedGetCurrentUser.mockResolvedValueOnce({
      id: "user-2",
      username: "user-2",
      name: "User 2",
      image: null
    });
    mockedCustomPool.findUnique.mockResolvedValue(pool({ visibility: Visibility.PRIVATE }));

    const userBResponse = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" }
    });

    expect(anonymousResponse.status).toBe(401);
    const anonymousPayload = await anonymousResponse.json();
    expect(anonymousPayload.error.message).toBe("请先登录。");

    expect(userBResponse.status).toBe(403);
  });
});

