import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/pools/[poolId]/runs/[runId]/comparisons/route";
import { getComparisonHistory } from "../src/lib/comparison-history-service";

vi.mock("../src/lib/dev-user", () => ({
  getOrCreateDevUser: vi.fn(async () => ({ id: "user-1" }))
}));

vi.mock("../src/lib/comparison-history-service", () => ({
  getComparisonHistory: vi.fn()
}));

const mockedGetComparisonHistory = vi.mocked(getComparisonHistory);

describe("comparisons API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetComparisonHistory.mockResolvedValue({ items: [] });
  });

  it("GET returns comparison history with the default limit", async () => {
    const response = await GET(
      new Request("http://test.local/api/pools/pool-1/runs/run-1/comparisons"),
      {
        params: {
          poolId: "pool-1",
          runId: "run-1"
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.items).toEqual([]);
    expect(mockedGetComparisonHistory).toHaveBeenCalledWith({
      userId: "user-1",
      poolId: "pool-1",
      runId: "run-1",
      limit: undefined
    });
  });

  it("GET passes the requested limit to the history service", async () => {
    await GET(
      new Request("http://test.local/api/pools/pool-1/runs/run-1/comparisons?limit=150"),
      {
        params: {
          poolId: "pool-1",
          runId: "run-1"
        }
      }
    );

    expect(mockedGetComparisonHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 150
      })
    );
  });
});
