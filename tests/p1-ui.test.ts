import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getComparisonResultForShortcut } from "../src/lib/match-shortcuts";

describe("P1 pool detail UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");

  it("keeps start match as the ready primary CTA", () => {
    expect(source).toContain('enterRun("match")');
    expect(source).toContain("登录后开始个人对决");
    expect(source).toContain("开始我的对决");
    expect(source).toContain('variant="primary"');
    expect(source).toContain("开始对决");
    expect(source).toContain("可开始");
  });

  it("shows personal hint only to logged-in non-owner on public/unlisted pools", () => {
    expect(source).toContain("!canManagePool && canPlayPool");
    expect(source).toContain("你的对决和榜单只属于你，不会影响创建者");
  });

  it("keeps additional import methods folded behind a secondary control", () => {
    expect(source).toContain("更多导入方式");
    expect(source).toContain("showMoreImportMethods");
    expect(source).toContain('setActiveTab("search")');
  });
});

describe("P1 match arena UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");

  it("renders a VS arena with two duel cards", () => {
    expect(source).toContain("VS");
    expect(source.match(/<DuelAnimeCard/g)?.length).toBe(2);
    expect(source).toContain("MatchShortcutHint");
  });

  it("maps keyboard shortcuts and ignores editable targets", () => {
    expect(getComparisonResultForShortcut({ key: "ArrowLeft", target: null })).toBe("LEFT_WIN");
    expect(getComparisonResultForShortcut({ key: "ArrowRight", target: null })).toBe("RIGHT_WIN");
    expect(getComparisonResultForShortcut({ key: "ArrowUp", target: null })).toBe("DRAW");
    expect(getComparisonResultForShortcut({ key: "ArrowDown", target: null })).toBe("SKIP");
    expect(getComparisonResultForShortcut({ key: "1", target: null })).toBe("LEFT_UNSEEN");
    expect(getComparisonResultForShortcut({ key: "2", target: null })).toBe("RIGHT_UNSEEN");
    expect(getComparisonResultForShortcut({ key: "0", target: null })).toBe("BOTH_UNSEEN");
    expect(
      getComparisonResultForShortcut({
        key: "ArrowLeft",
        target: { tagName: "INPUT", isContentEditable: false } as unknown as EventTarget
      })
    ).toBeNull();
  });
});

describe("P1 tier wall UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");

  it("treats export and share as primary tier actions", () => {
    expect(source).toContain("导出图片");
    expect(source).toContain("分享榜单");
    expect(source).toContain("生成你的榜单作品");
  });

  it("groups advanced tier controls behind a collapsible section", () => {
    expect(source).toContain("高级控制");
    expect(source).toContain("showAdvancedActions");
    expect(source).toContain("编辑最终设定");
    expect(source).toContain("恢复系统排序");
    expect(source).toContain("编辑分层标签");
    expect(source).toContain("校准榜单");
  });
});
