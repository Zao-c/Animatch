import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/app-error";
import { GET } from "../src/app/api/tier-shares/[token]/route";
import { POST } from "../src/app/api/tier-shares/route";
import { createTierShare, getPublicTierShare } from "../src/lib/tier-share-service";

vi.mock("../src/lib/dev-user", () => ({
  getOrCreateDevUser: vi.fn(async () => ({ id: "user-1" }))
}));

vi.mock("../src/lib/tier-share-service", () => ({
  createTierShare: vi.fn(),
  getPublicTierShare: vi.fn()
}));

const mockedCreateTierShare = vi.mocked(createTierShare);
const mockedGetPublicTierShare = vi.mocked(getPublicTierShare);

describe("tier shares API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST creates a tier share and returns the public URL", async () => {
    mockedCreateTierShare.mockResolvedValue({
      token: "token-1",
      url: "/share/tier/token-1",
      share: shareFixture()
    });

    const response = await POST(
      new Request("http://test.local/api/tier-shares", {
        method: "POST",
        body: JSON.stringify({
          poolId: "pool-1",
          runId: "run-1",
          tierLabels: { S: "神作" },
          snapshot: { forged: true }
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      token: "token-1",
      url: "/share/tier/token-1"
    });
    expect(mockedCreateTierShare).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        poolId: "pool-1",
        runId: "run-1",
        tierLabels: { S: "神作" }
      })
    );
  });

  it("POST returns Pool not found when the pool is missing", async () => {
    mockedCreateTierShare.mockRejectedValue(
      new AppError("Pool not found", 404, "POOL_NOT_FOUND")
    );

    const response = await POST(
      new Request("http://test.local/api/tier-shares", {
        method: "POST",
        body: JSON.stringify({
          poolId: "missing-pool",
          runId: "run-1"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.message).toBe("Pool not found");
  });

  it("POST returns an explicit error when the run does not belong to the pool", async () => {
    mockedCreateTierShare.mockRejectedValue(
      new AppError("Run does not belong to pool", 404, "RUN_POOL_MISMATCH")
    );

    const response = await POST(
      new Request("http://test.local/api/tier-shares", {
        method: "POST",
        body: JSON.stringify({
          poolId: "pool-1",
          runId: "other-run"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.message).toBe("Run does not belong to pool");
  });

  it("GET returns a public tier share", async () => {
    mockedGetPublicTierShare.mockResolvedValue(shareFixture());

    const response = await GET(new Request("http://test.local/api/tier-shares/token-1"), {
      params: { token: "token-1" }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.token).toBe("token-1");
    expect(payload.data.snapshot.tiers[0].label).toBe("神作");
  });

  it("GET returns 404 for missing token", async () => {
    mockedGetPublicTierShare.mockRejectedValue(
      new AppError("Tier share not found", 404, "TIER_SHARE_NOT_FOUND")
    );

    const response = await GET(new Request("http://test.local/api/tier-shares/missing"), {
      params: { token: "missing" }
    });

    expect(response.status).toBe(404);
  });
});

function shareFixture() {
  return {
    token: "token-1",
    title: "Pool",
    description: null,
    tierLabels: {
      S: "神作",
      A: "A",
      B: "B",
      C: "C",
      D: "D"
    },
    snapshot: {
      version: 1 as const,
      generatedAt: "2026-06-11T12:00:00.000Z",
      pool: { id: "pool-1", name: "Pool" },
      run: { id: "run-1" },
      tiers: [
        {
          key: "S" as const,
          label: "神作",
          items: [
            {
              animeId: "anime-1",
              title: "Custom Upload",
              coverUrl: "/uploads/custom-items/item.png",
              source: "CUSTOM_UPLOAD"
            }
          ]
        }
      ]
    },
    createdAt: "2026-06-11T12:00:00.000Z"
  };
}
