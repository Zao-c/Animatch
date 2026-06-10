import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { DELETE, GET as GET_POOL, PATCH } from "../src/app/api/pools/[poolId]/route";
import { GET as LIST_POOLS } from "../src/app/api/pools/route";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/dev-user", () => ({
  getOrCreateDevUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockedCustomPool = vi.mocked(prisma.customPool);

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
    cloneCount: 0,
    useCount: 0,
    likeCount: 0,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    poolAnime: [],
    ...overrides,
  };
}

describe("pools API management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(prisma).not.toHaveProperty("poolAnime.delete");
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

  it("GET pool detail still returns archived pools for history viewing", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({ status: PoolStatus.ARCHIVED, deletedAt: new Date() })
    );

    const response = await GET_POOL(new Request("http://test.local/api/pools/pool-1"), {
      params: { poolId: "pool-1" },
    });

    expect(response.status).toBe(200);
  });
});
