import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public pools view UI", () => {
  const poolsSource = readFileSync("src/app/pools/page.tsx", "utf8");
  const homeActionsSource = readFileSync("src/components/HomeActions.tsx", "utf8");

  it("initializes /pools?view=public as the public pools view", () => {
    expect(poolsSource).toContain('parsePoolView(searchParams.get("view"))');
    expect(poolsSource).toContain('case "public":');
    expect(poolsSource).toContain('return "PUBLIC"');
    expect(poolsSource).toContain('value="PUBLIC"');
  });

  it("keeps view changes synced back to the URL", () => {
    expect(poolsSource).toContain("function handleViewChange(nextView: PoolView)");
    expect(poolsSource).toContain("poolViewToQueryValue(nextView)");
    expect(poolsSource).toContain("router.replace(`/pools${nextQuery ? `?${nextQuery}` : \"\"}`");
  });

  it("shows clear public pools title and community battle copy", () => {
    expect(poolsSource).toContain('title: "公开番组"');
    expect(poolsSource).toContain("社区大乱斗");
    expect(poolsSource).toContain("个人 Tier List");
    expect(poolsSource).toContain("匿名聚合");
    expect(poolsSource).toContain("社区榜单");
  });

  it("uses a public-specific empty state instead of a mine-pool empty state", () => {
    expect(poolsSource).toContain("暂无公开番组");
    expect(poolsSource).toContain("公开番组开放后会出现在这里");
    expect(poolsSource).toContain("查看我的番组");
  });

  it("keeps the default /pools behavior available", () => {
    expect(poolsSource).toContain("case \"DEFAULT\"");
    expect(poolsSource).toContain("return undefined");
    expect(poolsSource).toContain('href="/pools/new"');
    expect(poolsSource).toContain('title: "我的番组"');
  });

  it("marks public cards as community battle joinable without extra ranking fetches", () => {
    expect(poolsSource).toContain("可参与社区大乱斗");
    expect(poolsSource).toContain("加入大乱斗");
    expect(poolsSource).toContain("登录后加入大乱斗");
    expect(poolsSource).not.toContain("getCommunityRanking");
  });

  it("lets anonymous users browse public pools without immediate login", () => {
    expect(poolsSource).not.toContain("getMe");
    expect(poolsSource).not.toContain("requireCurrentUser");
    expect(poolsSource).toContain("所有人都可以浏览公开番组");
  });

  it("keeps the responsive filter layout table-free", () => {
    expect(poolsSource).toContain("grid gap-4");
    expect(poolsSource).toContain("md:grid-cols-2");
    expect(poolsSource).not.toContain("<table");
  });

  it("keeps public pool cards stable without community ranking N+1 queries", () => {
    expect(poolsSource).toContain("flex h-full flex-col overflow-hidden");
    expect(poolsSource).toContain("grid h-28 grid-cols-5");
    expect(poolsSource).toContain("line-clamp-2 min-h-10");
    expect(poolsSource).toContain("mt-auto pt-4");
    expect(poolsSource).toContain("更多操作");
    expect(poolsSource).not.toContain("getCommunityRanking");
  });

  it("home links point directly to /pools?view=public", () => {
    const matches = homeActionsSource.match(/href="\/pools\?view=public"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
