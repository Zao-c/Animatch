import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/pools/[poolId]/runs/[runId]/reset/route";
import { AppError } from "../src/lib/app-error";
import { requireCurrentUser } from "../src/lib/auth-session";
import { resetRunForUser } from "../src/lib/run-service";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn()
}));

vi.mock("../src/lib/run-service", () => ({
  resetRunForUser: vi.fn()
}));

const mockedRequireCurrentUser = vi.mocked(requireCurrentUser);
const mockedResetRunForUser = vi.mocked(resetRunForUser);

describe("run reset API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireCurrentUser.mockResolvedValue({
      id: "user-a",
      username: "user-a",
      name: "User A",
      image: null
    });
    mockedResetRunForUser.mockResolvedValue({
      run: {
        id: "run-new"
      } as Awaited<ReturnType<typeof resetRunForUser>>["run"],
      scoreCount: 2,
      redirectTo: "/pools/pool-1/runs/run-new/match"
    });
  });

  it("returns 401 when the user is not logged in", async () => {
    mockedRequireCurrentUser.mockRejectedValue(
      new AppError("Authentication required", 401, "AUTH_REQUIRED")
    );

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/runs/run-old/reset", {
        method: "POST"
      }),
      {
        params: {
          poolId: "pool-1",
          runId: "run-old"
        }
      }
    );

    expect(response.status).toBe(401);
    expect(mockedResetRunForUser).not.toHaveBeenCalled();
  });

  it("resets the current user's run and returns the match redirect", async () => {
    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/runs/run-old/reset", {
        method: "POST"
      }),
      {
        params: {
          poolId: "pool-1",
          runId: "run-old"
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      runId: "run-new",
      poolId: "pool-1",
      redirectTo: "/pools/pool-1/runs/run-new/match"
    });
    expect(mockedResetRunForUser).toHaveBeenCalledWith({
      userId: "user-a",
      poolId: "pool-1",
      runId: "run-old"
    });
  });

  it("preserves run ownership errors from the service", async () => {
    mockedResetRunForUser.mockRejectedValue(
      new AppError("Run does not belong to the current user", 403, "RUN_FORBIDDEN")
    );

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/runs/run-old/reset", {
        method: "POST"
      }),
      {
        params: {
          poolId: "pool-1",
          runId: "run-old"
        }
      }
    );

    expect(response.status).toBe(403);
  });

  it("returns a clear error when the pool has fewer than two active anime", async () => {
    mockedResetRunForUser.mockRejectedValue(
      new AppError("至少需要 2 部作品才能重开本轮。", 400, "RUN_RESET_NOT_ENOUGH_ANIME")
    );

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/runs/run-old/reset", {
        method: "POST"
      }),
      {
        params: {
          poolId: "pool-1",
          runId: "run-old"
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("至少需要 2 部作品才能重开本轮。");
  });
});
