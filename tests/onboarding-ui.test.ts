import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("onboarding guide copy", () => {
  const homeSource = readFileSync("src/app/page.tsx", "utf8");
  const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
  const matchSource = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");
  const tierSource = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");

  it("shows the home onboarding guide", () => {
    expect(homeSource).toContain("怎么玩 AniMatch");
    expect(homeSource).toContain("浏览公开番组");
    expect(homeSource).toContain("开始个人对决");
    expect(homeSource).toContain("创建自己的番组");
    expect(homeSource).toContain("分享 Tier List");
  });

  it("shows public pool anonymous onboarding copy", () => {
    expect(detailSource).toContain("你可以先浏览作品墙，登录后开始自己的个人对决。");
    expect(detailSource).toContain("!canManagePool");
    expect(detailSource).toContain("!canPlayPool");
  });

  it("shows logged-in non-owner personal-run copy", () => {
    expect(detailSource).toContain("你的对决和榜单只属于你，不会影响创建者。");
    expect(detailSource).toContain("canPlayPool");
  });

  it("shows owner pool settings copy", () => {
    expect(detailSource).toContain("你可以在番组设置里切换公开/私有，并继续维护作品墙。");
    expect(detailSource).toContain("canManagePool");
  });

  it("explains match undo, skip, unseen, and reset actions", () => {
    expect(matchSource).toContain("怎么对决");
    expect(matchSource).toContain("左右选择你更喜欢的作品");
    expect(matchSource).toContain("可以跳过，或标记没看过");
    expect(matchSource).toContain("点错可以撤回上次选择");
    expect(matchSource).toContain("想重来可以重开本轮");
  });

  it("explains tier sharing, export, and manual display behavior", () => {
    expect(tierSource).toContain("Tier List 根据你的对决结果生成");
    expect(tierSource).toContain("可以分享榜单");
    expect(tierSource).toContain("也可以导出图片");
    expect(tierSource).toContain("手动调整只影响榜单展示和当前手动排序");
    expect(tierSource).toContain("不会改写对决历史");
  });

  it("explains add-anime Chinese tag secondary search", () => {
    expect(detailSource).toContain("可以先选“恋爱 / 校园 / 异世界”等标签，再输入关键词二次检索。");
  });

  it("explains the TierMaker import assistant fallback", () => {
    expect(detailSource).toContain("如果自动解析失败，可以复制导入助手脚本，在 TierMaker 页面运行后粘贴图片链接。");
  });

  it("keeps onboarding surfaces wrapped for narrow mobile widths", () => {
    expect(homeSource).toContain("sm:grid-cols-2 lg:grid-cols-4");
    expect(detailSource).toContain("flex flex-wrap");
    expect(matchSource).toContain("flex flex-wrap");
    expect(tierSource).toContain("sm:flex-row sm:flex-wrap");
    for (const source of [homeSource, detailSource, matchSource, tierSource]) {
      expect(source).not.toMatch(/\b(?:w|mini?-w)-screen\b/);
      expect(source).not.toMatch(/(?:w|mini?-w)-\[1264px\]/);
    }
  });
});
