import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pool management UI", () => {
  const poolsSource = readFileSync("src/app/pools/page.tsx", "utf8");
  const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");

  it("exposes management filters, sorting, and UI statuses", () => {
    expect(poolsSource).toContain("可开始");
    expect(poolsSource).toContain("对决中");
    expect(poolsSource).toContain("已稳定");
    expect(poolsSource).toContain("未添加动画");
    expect(poolsSource).toContain("已归档");
    expect(poolsSource).toContain("动画数量");
    expect(poolsSource).toContain("对决数量");
    expect(poolsSource).toContain("最近更新");
  });

  it("keeps archive management folded behind more actions", () => {
    expect(poolsSource).toContain("更多操作");
    expect(poolsSource).toContain("编辑信息");
    expect(poolsSource).toContain("归档番组");
    expect(poolsSource).toContain("恢复番组");
    expect(poolsSource).toContain("复制番组 ID");
  });

  it("offers demo pool onboarding from the empty state", () => {
    expect(poolsSource).toContain("体验示例番组");
    expect(poolsSource).toContain("正在准备体验池...");
    expect(poolsSource).toContain("createDemoPool");
  });

  it("shows archived pools as read-only on detail while keeping restore available", () => {
    expect(detailSource).toContain("这个番组已归档，只能查看，不能继续添加或对决。");
    expect(detailSource).toContain("恢复后你可以继续添加动画和对决。");
    expect(detailSource).toContain("恢复番组");
    expect(detailSource).toContain("归档番组不能继续添加动画。");
  });
});
