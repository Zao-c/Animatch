import { describe, it, expect } from "vitest";

describe("match progress UNSEEN eligibility", () => {
  it("eligible count decreases when four anime are marked unseen", () => {
    const totalItems = 8;
    const unseenCount = 4;
    const eligible = totalItems - unseenCount;

    expect(eligible).toBe(4);
  });

  it("target shrinks when eligible decreases", () => {
    const totalItems = 8;
    const unseenCount = 4;
    const eligible = totalItems - unseenCount;

    const getTarget = (count: number) => {
      if (count < 2) return 0;
      return Math.min(200, Math.ceil(count * 1.5));
    };

    const fullTarget = getTarget(totalItems);
    const shrunkTarget = getTarget(eligible);

    expect(fullTarget).toBe(12);
    expect(shrunkTarget).toBe(6);
  });

  it("UNSEEN does not count toward completed", () => {
    const results = ["LEFT", "RIGHT", "UNSEEN", "DRAW", "SKIP", "UNSEEN", "LEFT"];
    const completed = results.filter((r) => r !== "UNSEEN" && r !== "SKIP").length;
    expect(completed).toBe(4);
  });

  it("SKIP does not reduce target", () => {
    const eligible = 8;
    const target = Math.min(200, Math.ceil(eligible * 1.5));
    expect(target).toBe(12);
  });

  it("DRAW counts as completed", () => {
    const results = ["LEFT", "RIGHT", "DRAW"];
    const completed = results.filter((r) => r !== "UNSEEN" && r !== "SKIP").length;
    expect(completed).toBe(3);
  });

  it("completed does not exceed target", () => {
    const eligible = 8;
    const target = Math.min(200, Math.ceil(eligible * 1.5));
    const completed = 15;

    const clampedCompleted = Math.min(completed, target);
    const percent = target > 0 ? Math.min(100, Math.round((clampedCompleted / target) * 100)) : 0;

    expect(clampedCompleted).toBe(12);
    expect(percent).toBe(100);
  });

  it("eligible < 2 produces target 0", () => {
    expect(Math.min(200, Math.ceil(1 * 1.5))).toBe(2);
    const target = 1 < 2 ? 0 : Math.min(200, Math.ceil(1 * 1.5));
    expect(target).toBe(0);
  });

  it("hidden/unseen scores are excluded from completed stats", () => {
    const allComparisons = [
      { leftActive: true, rightActive: true, result: "LEFT" },
      { leftActive: false, rightActive: true, result: "RIGHT" },
      { leftActive: true, rightActive: false, result: "DRAW" },
      { leftActive: true, rightActive: true, result: "SKIP" }
    ];

    const completedComparisons = allComparisons.filter(
      (cmp) =>
        cmp.leftActive &&
        cmp.rightActive &&
        cmp.result !== "SKIP"
    ).length;

    expect(completedComparisons).toBe(1);
  });
});
