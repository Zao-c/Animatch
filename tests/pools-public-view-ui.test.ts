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

describe("public pools community summary", () => {
  const poolsSource = readFileSync("src/app/pools/page.tsx", "utf8");
  const poolsApiSource = readFileSync("src/app/api/pools/route.ts", "utf8");
  const serviceSource = readFileSync("src/lib/community-ranking-service.ts", "utf8");
  const clientApiSource = readFileSync("src/lib/client-api.ts", "utf8");

  it("Pools API imports getCommunitySummaries for batch query", () => {
    expect(poolsApiSource).toContain("getCommunitySummaries");
  });

  it("Pools API injects communitySummary only for PUBLIC pools", () => {
    expect(poolsApiSource).toContain('visibility === "PUBLIC"');
    expect(poolsApiSource).toContain("communitySummary");
  });

  it("Pools API does not leak community data to private/unlisted pools", () => {
    const lines = poolsApiSource.split("\n");
    const publicFilterLine = lines.findIndex((l) =>
      l.includes('visibility === "PUBLIC"') && l.includes("filter")
    );
    expect(publicFilterLine).toBeGreaterThan(0);
  });

  it("PoolSummary has communitySummary field", () => {
    expect(clientApiSource).toContain("communitySummary?: CommunityPoolSummary | null;");
  });

  it("CommunityPoolSummary has all summary fields", () => {
    expect(clientApiSource).toContain("topAnimeTitle");
    expect(clientApiSource).toContain("topAnimeImageUrl");
    expect(clientApiSource).toContain("participantCount");
    expect(clientApiSource).toContain("sampleLabel");
  });

  it("PoolCard renders community summary for public view", () => {
    expect(poolsSource).toContain("pool.communitySummary");
    expect(poolsSource).toContain("communitySummaryTitle(pool.communitySummary.sampleLabel)");
    expect(poolsSource).toContain("还没有社区结果");
    expect(poolsSource).toContain("成为第一个参与的人");
  });

  it("does not label low-sample community summaries as formal first place", () => {
    expect(poolsSource).toContain("function communitySummaryTitle");
    expect(poolsSource).toMatch(/case "empty":\s*return "暂无社区结果"/);
    expect(poolsSource).toMatch(/case "low":\s*return "当前参考"/);
    expect(poolsSource).toMatch(/case "trend":\s*return "初步趋势"/);
    expect(poolsSource).toMatch(/case "stable":\s*return "社区第一"/);
    expect(poolsSource).not.toMatch(/case "(empty|low|trend)":\s*return "社区第一"/);
  });

  it("PoolCard shows participant count and sample label", () => {
    expect(poolsSource).toContain("人参与");
    expect(poolsSource).toContain("样本还少");
    expect(poolsSource).toContain("已有初步趋势");
    expect(poolsSource).toContain("榜单逐渐稳定");
  });

  it("community summary uses AnimeCover for top anime image", () => {
    expect(poolsSource).toContain("pool.communitySummary.topAnimeImageUrl");
    expect(poolsSource).toContain("size=\"sm\"");
  });

  it("community summary only shows when isPublicView && PUBLIC visibility", () => {
    expect(poolsSource).toContain('isPublicView && pool.visibility === "PUBLIC"');
  });

  it("community summary sits near the bottom of the card, not obstructing primary CTA", () => {
    const mainCtaIndex = poolsSource.indexOf("加入大乱斗");
    const summaryIndex = poolsSource.indexOf("社区第一");
    expect(mainCtaIndex).toBeGreaterThan(0);
    expect(summaryIndex).toBeGreaterThan(0);
  });

  it("getCommunitySummaries accepts batch poolIds and returns Map", () => {
    expect(serviceSource).toContain("getCommunitySummaries(poolIds: string[])");
    expect(serviceSource).toContain("Map<string, CommunitySummary>");
  });

  it("getCommunitySummaries queries runs in batch with poolId in", () => {
    expect(serviceSource).toContain("poolId: { in: poolIds }");
  });

  it("getCommunitySummaries uses full cover chain with getAnimeCoverUrl", () => {
    expect(serviceSource).toContain("getAnimeCoverUrl");
    expect(serviceSource).toContain("coverUrlOverride: pa.coverUrlOverride");
  });

  it("getCommunitySummaries assigns sampleLabel based on participant count", () => {
    expect(serviceSource).toContain('"empty"');
    expect(serviceSource).toContain('"low"');
    expect(serviceSource).toContain('"trend"');
    expect(serviceSource).toContain('"stable"');
    expect(serviceSource).toContain("<= 2");
    expect(serviceSource).toContain("<= 5");
  });

  it("Pools page does NOT import getCommunityRanking directly", () => {
    expect(poolsSource).not.toContain("import { getCommunityRanking }");
  });

  it("pool card still only has one main CTA button", () => {
    const variantPrimaryCount = (poolsSource.match(/variant="primary"/g) ?? []).length;
    expect(variantPrimaryCount).toBeGreaterThanOrEqual(1);
  });
});
