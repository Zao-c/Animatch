import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("match reset UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");

  it("shows a low-emphasis reset action with confirmation", () => {
    expect(source).toContain("重开本轮");
    expect(source).toContain("这会开启一轮新的对决，旧榜单和历史记录仍会保留。确定重开吗？");
    expect(source).toContain("window.confirm");
    expect(source).toContain("variant=\"quiet\"");
  });

  it("calls the reset API only after confirmation and redirects to the new run", () => {
    expect(source).toContain("resetRun(params.poolId, params.runId)");
    expect(source).toContain("router.push(result.redirectTo)");
    expect(source).toContain("return;");
  });
});
