import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/pools/[poolId]/runs/[runId]/undo-last/route";
import { AppError } from "../src/lib/app-error";
import { requireCurrentUser } from "../src/lib/auth-session";
import { undoLastComparison } from "../src/lib/undo-comparison-service";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn()
}));

vi.mock("../src/lib/undo-comparison-service", () => ({
  undoLastComparison: vi.fn()
}));

const mockedRequireCurrentUser = vi.mocked(requireCurrentUser);
const mockedUndoLastComparison = vi.mocked(undoLastComparison);

describe("undo-last comparison API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireCurrentUser.mockResolvedValue({
      id: "user-a",
      username: "user-a",
      name: "User A",
      image: null
    });
    mockedUndoLastComparison.mockResolvedValue({
      undoneComparisonId: "comparison-1",
      poolId: "pool-1",
      runId: "run-1",
      message: "已撤回上次选择。",
      redirectTo: "/pools/pool-1/runs/run-1/match"
    });
  });

  it("returns 401 when the user is not logged in", async () => {
    mockedRequireCurrentUser.mockRejectedValue(
      new AppError("Authentication required", 401, "AUTH_REQUIRED")
    );

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/runs/run-1/undo-last", {
        method: "POST"
      }),
      {
        params: {
          poolId: "pool-1",
          runId: "run-1"
        }
      }
    );

    expect(response.status).toBe(401);
    expect(mockedUndoLastComparison).not.toHaveBeenCalled();
  });

  it("returns the undone comparison and match redirect", async () => {
    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/runs/run-1/undo-last", {
        method: "POST"
      }),
      {
        params: {
          poolId: "pool-1",
          runId: "run-1"
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      undoneComparisonId: "comparison-1",
      poolId: "pool-1",
      runId: "run-1",
      message: "已撤回上次选择。",
      redirectTo: "/pools/pool-1/runs/run-1/match"
    });
    expect(mockedUndoLastComparison).toHaveBeenCalledWith({
      userId: "user-a",
      poolId: "pool-1",
      runId: "run-1"
    });
  });

  it("preserves forbidden errors from the service", async () => {
    mockedUndoLastComparison.mockRejectedValue(
      new AppError("Run does not belong to the current user", 403, "RUN_FORBIDDEN")
    );

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/runs/run-1/undo-last", {
        method: "POST"
      }),
      {
        params: {
          poolId: "pool-1",
          runId: "run-1"
        }
      }
    );

    expect(response.status).toBe(403);
  });

  it("returns a clear error when there is no comparison to undo", async () => {
    mockedUndoLastComparison.mockRejectedValue(
      new AppError("没有可以撤回的选择。", 400, "NO_COMPARISON_TO_UNDO")
    );

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/runs/run-1/undo-last", {
        method: "POST"
      }),
      {
        params: {
          poolId: "pool-1",
          runId: "run-1"
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.message).toBe("没有可以撤回的选择。");
  });
});
