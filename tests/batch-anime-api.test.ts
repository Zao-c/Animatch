import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { NextRequest } from "next/server";
import { POST as batchUpdateRoute } from "../src/app/api/pools/[poolId]/anime/batch-update/route";
import { POST as batchRemoveRoute } from "../src/app/api/pools/[poolId]/anime/batch-remove/route";
import {
  batchRemoveAnimeFromPool,
  batchUpdatePoolAnime
} from "../src/lib/client-api";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null }))
}));

vi.mock("../src/lib/admin-auth", () => ({
  isAdminEditSession: vi.fn(async () => false)
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn()
    },
    poolAnime: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);

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
    ...overrides
  };
}

const HEADERS = { "Content-Type": "application/json" };

/** The routes only select `id`, so a partial row is fine at runtime. */
function idRows(ids: string[]) {
  return ids.map((id) => ({ id })) as unknown as Awaited<
    ReturnType<typeof prisma.poolAnime.findMany>
  >;
}

function postRequest(path: string, body: unknown) {
  return new NextRequest(path.startsWith("http") ? path : `http://test.local${path}`, {
    method: "POST",
    headers: HEADERS,
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCustomPool.findUnique.mockResolvedValue(pool());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The client helpers previously wrapped the payload in `JSON.stringify` even
 * though `fetchJsonOnce` serializes once more, so the server received a JSON
 * *string* and always rejected the request. These tests capture the real
 * request body and replay it into the real route handler.
 */
describe("batch anime client/server contract", () => {
  it("batch update sends a single-encoded JSON object that the route accepts", async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        captured.push({ url, init });
        return new Response(JSON.stringify({ ok: true, data: { updated: 2 } }), {
          status: 200,
          headers: HEADERS
        });
      })
    );

    const clientResult = await batchUpdatePoolAnime("pool-1", ["entry-1", "entry-2"], {
      displayTitleOverride: "新标题",
      animeTypeOverride: "TV",
      overrideNote: "备注"
    });
    expect(clientResult.updated).toBe(2);

    expect(captured).toHaveLength(1);
    const { url, init } = captured[0];
    expect(url).toBe("/api/pools/pool-1/anime/batch-update");
    expect(init.method).toBe("POST");
    expect(typeof init.body).toBe("string");

    // The body must decode to an object (not a double-encoded string).
    const decoded = JSON.parse(init.body as string);
    expect(typeof decoded).toBe("object");
    expect(decoded).toEqual({
      poolAnimeIds: ["entry-1", "entry-2"],
      displayTitleOverride: "新标题",
      animeTypeOverride: "TV",
      overrideNote: "备注"
    });

    // Replay the exact captured request into the route handler.
    mockedPoolAnime.findMany.mockResolvedValue(idRows(["entry-1", "entry-2"]));
    mockedPoolAnime.updateMany.mockResolvedValue({ count: 2 });

    const response = await batchUpdateRoute(postRequest(url, init.body as string), {
      params: { poolId: "pool-1" }
    });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ updated: 2 });
    expect(mockedPoolAnime.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["entry-1", "entry-2"] }, poolId: "pool-1" } })
    );
    expect(mockedPoolAnime.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-1", "entry-2"] }, poolId: "pool-1" },
      data: { displayTitleOverride: "新标题", animeTypeOverride: "TV", overrideNote: "备注" }
    });
  });

  it("batch remove sends a single-encoded JSON object and the route deletes only existing entries", async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        captured.push({ url, init });
        return new Response(JSON.stringify({ ok: true, data: { removed: 1 } }), {
          status: 200,
          headers: HEADERS
        });
      })
    );

    const clientResult = await batchRemoveAnimeFromPool("pool-1", ["entry-1", "entry-2"]);
    expect(clientResult.removed).toBe(1);

    const { url, init } = captured[0];
    expect(url).toBe("/api/pools/pool-1/anime/batch-remove");
    expect(JSON.parse(init.body as string)).toEqual({ poolAnimeIds: ["entry-1", "entry-2"] });

    // Only entry-1 belongs to this pool.
    mockedPoolAnime.findMany.mockResolvedValue(idRows(["entry-1"]));
    mockedPoolAnime.deleteMany.mockResolvedValue({ count: 1 });

    const response = await batchRemoveRoute(postRequest(url, init.body as string), {
      params: { poolId: "pool-1" }
    });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ removed: 1 });
    expect(mockedPoolAnime.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["entry-1", "entry-2"] }, poolId: "pool-1" } })
    );
    expect(mockedPoolAnime.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["entry-1"] }, poolId: "pool-1" }
    });
  });

  it("rejects a double-encoded (string) body to document the contract", async () => {
    const doubleEncoded = JSON.stringify(
      JSON.stringify({ poolAnimeIds: ["entry-1"], displayTitleOverride: "x" })
    );

    const response = await batchUpdateRoute(
      postRequest("/api/pools/pool-1/anime/batch-update", doubleEncoded),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.updateMany).not.toHaveBeenCalled();
  });
});

describe("batch update route validation", () => {
  it("rejects a missing/empty poolAnimeIds array", async () => {
    const response = await batchUpdateRoute(
      postRequest("/api/pools/pool-1/anime/batch-update", { displayTitleOverride: "x" }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a request with no updatable field", async () => {
    const response = await batchUpdateRoute(
      postRequest("/api/pools/pool-1/anime/batch-update", { poolAnimeIds: ["entry-1"] }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range anime type", async () => {
    const response = await batchUpdateRoute(
      postRequest("/api/pools/pool-1/anime/batch-update", {
        poolAnimeIds: ["entry-1"],
        animeTypeOverride: "NOT_A_TYPE"
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when none of the ids belong to this pool", async () => {
    mockedPoolAnime.findMany.mockResolvedValue([]);

    const response = await batchUpdateRoute(
      postRequest("/api/pools/pool-1/anime/batch-update", {
        poolAnimeIds: ["other-pool-entry"],
        displayTitleOverride: "x"
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.updateMany).not.toHaveBeenCalled();
  });

  it("forbids a non-owner without edit permission", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool({ creatorId: "someone-else" }));

    const response = await batchUpdateRoute(
      postRequest("/api/pools/pool-1/anime/batch-update", {
        poolAnimeIds: ["entry-1"],
        displayTitleOverride: "x"
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(403);
    expect(mockedPoolAnime.updateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing pool", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(null);

    const response = await batchUpdateRoute(
      postRequest("/api/pools/missing/anime/batch-update", {
        poolAnimeIds: ["entry-1"],
        displayTitleOverride: "x"
      }),
      { params: { poolId: "missing" } }
    );

    expect(response.status).toBe(404);
  });
});

describe("batch remove route validation", () => {
  it("rejects a missing/empty poolAnimeIds array", async () => {
    const response = await batchRemoveRoute(
      postRequest("/api/pools/pool-1/anime/batch-remove", {}),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects when none of the ids belong to this pool", async () => {
    mockedPoolAnime.findMany.mockResolvedValue([]);

    const response = await batchRemoveRoute(
      postRequest("/api/pools/pool-1/anime/batch-remove", { poolAnimeIds: ["other-pool-entry"] }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.deleteMany).not.toHaveBeenCalled();
  });

  it("forbids a non-owner without edit permission", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool({ creatorId: "someone-else" }));

    const response = await batchRemoveRoute(
      postRequest("/api/pools/pool-1/anime/batch-remove", { poolAnimeIds: ["entry-1"] }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(403);
    expect(mockedPoolAnime.deleteMany).not.toHaveBeenCalled();
  });
});
