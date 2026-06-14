import { PoolComparisonMode, PoolComparisonResult, PoolStatus, Visibility } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as LIST_POOLS } from "../src/app/api/pools/route";
import { GET as GET_POOL } from "../src/app/api/pools/[poolId]/route";
import { POST as POST_COMPARISON } from "../src/app/api/pools/[poolId]/runs/[runId]/comparisons/route";
import { GET as GET_TIERLIST } from "../src/app/api/pools/[poolId]/runs/[runId]/tierlist/route";
import { POST as POST_DEMO_POOL } from "../src/app/api/demo-pool/route";
import { AppError } from "../src/lib/app-error";
import { requireCurrentUser } from "../src/lib/auth-session";
import { prisma } from "../src/lib/db";
import { getOrCreateDemoPool } from "../src/lib/demo-pool";
import { submitComparison } from "../src/lib/match-service";
import { getRunTierList } from "../src/lib/tier-service";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn()
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

vi.mock("../src/lib/match-service", () => ({
  submitComparison: vi.fn()
}));

vi.mock("../src/lib/tier-service", () => ({
  getRunTierList: vi.fn()
}));

vi.mock("../src/lib/demo-pool", () => ({
  getOrCreateDemoPool: vi.fn()
}));

const mockedRequireCurrentUser = vi.mocked(requireCurrentUser);
const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedSubmitComparison = vi.mocked(submitComparison);
const mockedGetRunTierList = vi.mocked(getRunTierList);
const mockedGetOrCreateDemoPool = vi.mocked(getOrCreateDemoPool);

function setCurrentUser(id: string) {
  mockedRequireCurrentUser.mockResolvedValue({
    id,
    username: id,
    name: id,
    image: null
  });
}

function poolFixture(creatorId: string) {
  return {
    id: "pool-a",
    creatorId,
    name: "User A Pool",
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
    _count: {
      poolAnime: 0,
      poolComparisons: 0
    }
  };
}

describe("friend auth user isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps userA pools out of userB pool list", async () => {
    setCurrentUser("user-b");
    mockedCustomPool.findMany.mockResolvedValue([]);

    const response = await LIST_POOLS(new Request("http://test.local/api/pools"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items).toEqual([]);
    expect(mockedCustomPool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creatorId: "user-b"
        })
      })
    );
  });

  it("blocks userB from reading userA pool detail", async () => {
    setCurrentUser("user-b");
    mockedCustomPool.findUnique.mockResolvedValue(poolFixture("user-a") as any);

    const response = await GET_POOL(new Request("http://test.local/api/pools/pool-a"), {
      params: {
        poolId: "pool-a"
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.message).toBe("你没有权限访问这个番组。");
    expect(payload.error.message).not.toContain("current dev user");
  });

  it("passes userB identity to comparison submission for run ownership enforcement", async () => {
    setCurrentUser("user-b");
    mockedSubmitComparison.mockRejectedValue(
      new AppError("Run does not belong to the current user", 403, "RUN_FORBIDDEN")
    );

    const response = await POST_COMPARISON(
      new Request("http://test.local/api/pools/pool-a/runs/run-a/comparisons", {
        method: "POST",
        body: JSON.stringify({
          leftAnimeId: "anime-1",
          rightAnimeId: "anime-2",
          result: PoolComparisonResult.LEFT_WIN,
          mode: PoolComparisonMode.NORMAL,
          clientMutationId: "mutation-1"
        })
      }),
      {
        params: {
          poolId: "pool-a",
          runId: "run-a"
        }
      }
    );

    expect(response.status).toBe(403);
    expect(mockedSubmitComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-b",
        poolId: "pool-a",
        runId: "run-a"
      })
    );
  });

  it("passes userB identity to tierlist lookup for run ownership enforcement", async () => {
    setCurrentUser("user-b");
    mockedGetRunTierList.mockRejectedValue(
      new AppError("Run does not belong to the current user", 403, "RUN_FORBIDDEN")
    );

    const response = await GET_TIERLIST(
      new Request("http://test.local/api/pools/pool-a/runs/run-a/tierlist"),
      {
        params: {
          poolId: "pool-a",
          runId: "run-a"
        }
      }
    );

    expect(response.status).toBe(403);
    expect(mockedGetRunTierList).toHaveBeenCalledWith({
      userId: "user-b",
      poolId: "pool-a",
      runId: "run-a"
    });
  });

  it("creates independent demo pools for userA and userB", async () => {
    setCurrentUser("user-a");
    mockedGetOrCreateDemoPool.mockResolvedValueOnce({
      poolId: "demo-a",
      runId: "run-a",
      created: true,
      animeCount: 9,
      redirectTo: "/pools/demo-a/runs/run-a/match"
    });

    const userAResponse = await POST_DEMO_POOL();
    const userAPayload = await userAResponse.json();

    setCurrentUser("user-b");
    mockedGetOrCreateDemoPool.mockResolvedValueOnce({
      poolId: "demo-b",
      runId: "run-b",
      created: true,
      animeCount: 10,
      redirectTo: "/pools/demo-b/runs/run-b/match"
    });

    const userBResponse = await POST_DEMO_POOL();
    const userBPayload = await userBResponse.json();

    expect(userAPayload.data.poolId).toBe("demo-a");
    expect(userBPayload.data.poolId).toBe("demo-b");
    expect(userAPayload.data.animeCount).toBe(9);
    expect(userBPayload.data.animeCount).toBe(10);
    expect(mockedGetOrCreateDemoPool).toHaveBeenNthCalledWith(1, "user-a");
    expect(mockedGetOrCreateDemoPool).toHaveBeenNthCalledWith(2, "user-b");
  });
});
