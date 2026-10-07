import { beforeEach, expect, it, vi } from "vitest";
import { GET, PUT, DELETE } from "../src/app/api/pools/[poolId]/tier-maker/route";
import { requireCurrentUser } from "../src/lib/auth-session";
import { getManualBoard, saveManualBoard, revokeManualBoardShare } from "../src/lib/manual-board-service";
import { AppError } from "../src/lib/app-error";
vi.mock("../src/lib/auth-session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("../src/lib/manual-board-service", () => ({ getManualBoard: vi.fn(), saveManualBoard: vi.fn(), revokeManualBoardShare: vi.fn() }));
const context = { params: { poolId: "pool" } };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(requireCurrentUser).mockResolvedValue({ id: "current-user", username: "test", name: null, image: null }); });
it("requires authentication for reads, writes and revocations", async () => {
  vi.mocked(requireCurrentUser).mockRejectedValue(new AppError("请登录", 401));
  for (const handler of [GET, PUT, DELETE]) {
    const response = await handler(new Request("http://localhost/api"), context);
    expect(response.status).toBe(401);
  }
  expect(getManualBoard).not.toHaveBeenCalled();
  expect(saveManualBoard).not.toHaveBeenCalled();
  expect(revokeManualBoardShare).not.toHaveBeenCalled();
});
it("uses the session owner even when a body tries to supply another owner", async () => {
  vi.mocked(saveManualBoard).mockResolvedValue({ revision: 1, shareUrl: null });
  const body = { ownerId: "someone-else", title: "我的榜单", revision: 0, publish: false };
  const response = await PUT(new Request("http://localhost/api", { method: "PUT", body: JSON.stringify(body) }), context);
  expect(response.status).toBe(200);
  expect(saveManualBoard).toHaveBeenCalledWith("current-user", "pool", body, false);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("preserves a revision conflict as 409 for the editor", async () => {
  vi.mocked(saveManualBoard).mockRejectedValue(new AppError("榜单已更新", 409));
  expect((await PUT(new Request("http://localhost/api", { method: "PUT", body: "{}" }), context)).status).toBe(409);
});
