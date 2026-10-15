import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("match undo UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");

  it("shows a low-emphasis undo action behind a confirmation", () => {
    // Anchor on behaviour/handlers instead of transient UI copy.
    expect(source).toContain("handleUndoLast");
    expect(source).toContain("window.confirm");
    expect(source).toContain('variant="quiet"');
  });

  it("calls undo API after confirmation and refreshes the match queue", () => {
    expect(source).toContain("undoLastComparison(params.poolId, params.runId)");
    expect(source).toContain("await loadInitialQueue()");
    expect(source).toContain("setNotice(result.message)");
  });
});
