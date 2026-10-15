import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("match empty state UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");

  it("uses queue progress to distinguish hidden/unseen exhaustion from a small pool", () => {
    // Anchor on the copy resolver and its inputs rather than the exact wording.
    expect(source).toContain("getMatchEmptyCopy(poolAnimeCount, queueMeta?.progress)");
    expect(source).toContain("progress.totalItems < 2");
    expect(source).not.toContain("当前番组的可用组合已经比较完了");
  });

  it("offers reset from empty state only when the run can be recalibrated", () => {
    expect(source).toContain("emptyCopy.canReset");
    expect(source).toContain("onClick={handleResetRun}");
    expect(source).toContain("canReset: false");
    expect(source).toContain("canReset: true");
  });

  it("distinguishes a refill failure from a legitimately exhausted queue", () => {
    expect(source).toContain("const [refillError, setRefillError]");
    expect(source).toContain("loadInitialQueue");
    expect(source).toContain("queue.length < 3");
  });

  it("explains high-confidence and exhausted queues without implying the site broke", () => {
    expect(source).toContain('progress?.stage === "HIGH_CONFIDENCE"');
    expect(source).toContain("poolAnimeCount >= 2");
    expect(source).not.toContain("当前番组的可用组合已经比较完了");
  });
});
