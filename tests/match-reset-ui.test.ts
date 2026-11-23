import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("match reset UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");

  it("shows a low-emphasis reset action behind a confirmation", () => {
    // Anchor on behaviour/handlers instead of transient UI copy.
    expect(source).toContain("handleResetRun");
    expect(source).toContain("window.confirm");
    expect(source).toContain('variant="quiet"');
  });

  it("calls the reset API only after confirmation and redirects to the new run", () => {
    expect(source).toContain("resetRun(params.poolId, params.runId)");
    expect(source).toContain("router.push(result.redirectTo)");
  });
});
