import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/pools/[poolId]/community-ranking/route";
import { AppError } from "../src/lib/app-error";
import { getCommunityRanking } from "../src/lib/community-ranking-service";

vi.mock("../src/lib/community-ranking-service", () => ({
  getCommunityRanking: vi.fn()
}));

const mockedGetCommunityRanking = vi.mocked(getCommunityRanking);

describe("community ranking API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCommunityRanking.mockResolvedValue({
      poolId: "pool-1",
      totalParticipants: 0,
      totalRuns: 0,
      totalAnime: 0,
      minSampleThreshold: {
        minUsers: 3,
        minComparisons: 6
      },
      items: []
    });
  });

  it("GET /api/pools/[poolId]/community-ranking returns the service payload", async () => {
    const response = await GET(
      new Request("http://test.local/api/pools/pool-1/community-ranking"),
      {
        params: {
          poolId: "pool-1"
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      data: {
        poolId: "pool-1",
        totalParticipants: 0,
        totalRuns: 0,
        totalAnime: 0,
        minSampleThreshold: {
          minUsers: 3,
          minComparisons: 6
        },
        items: []
      }
    });
    expect(mockedGetCommunityRanking).toHaveBeenCalledWith("pool-1");
  });

  it("maps unavailable private or unlisted pools to service errors", async () => {
    mockedGetCommunityRanking.mockRejectedValueOnce(
      new AppError(
        "Community ranking is only available for active public pools",
        404,
        "COMMUNITY_RANKING_NOT_AVAILABLE"
      )
    );

    const response = await GET(
      new Request("http://test.local/api/pools/private-pool/community-ranking"),
      {
        params: {
          poolId: "private-pool"
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.message).toBe(
      "Community ranking is only available for active public pools"
    );
  });
});
