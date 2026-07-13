import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("match empty state UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");

  it("uses queue progress to distinguish hidden/unseen exhaustion from a small pool", () => {
    expect(source).toContain("getMatchEmptyCopy(poolAnimeCount, queueMeta?.progress)");
    expect(source).toContain('progress.totalItems < 2');
    expect(source).toContain("可匹配作品不足");
    expect(source).toContain("你标记为没看过的作品已从本轮隐藏");
    expect(source).not.toContain("当前番组的可用组合已经比较完了");
  });

  it("offers reset from empty state only when the run can be recalibrated", () => {
    expect(source).toContain("emptyCopy.canReset");
    expect(source).toContain("onClick={handleResetRun}");
    expect(source).toContain("至少需要 2 部动画才能开始对决");
    expect(source).toContain("canReset: false");
    expect(source).toContain("canReset: true");
  });

  it("distinguishes a refill failure from a legitimately exhausted queue", () => {
    expect(source).toContain("const [refillError, setRefillError]");
    expect(source).toContain("下一组对决暂时没有加载成功");
    expect(source).toContain("你的上一票已经保存");
    expect(source).toContain("重新加载下一组");
    expect(source).toContain("queue.length < 3");
  });

  it("explains high-confidence and exhausted queues without implying the site broke", () => {
    expect(source).toContain('progress?.stage === "HIGH_CONFIDENCE"');
    expect(source).toContain("本轮已经达到高可信度");
    expect(source).toContain("当前没有新的可用组合");
    expect(source).toContain("可能是本轮组合已经比较完");
  });
});
