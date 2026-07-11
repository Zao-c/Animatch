import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("community ranking UI wiring", () => {
  const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
  const tierSource = readFileSync(
    "src/app/pools/[poolId]/runs/[runId]/tier/page.tsx",
    "utf8"
  );

  it("shows the community ranking entry only for active public pool detail", () => {
    expect(detailSource).toContain("const canShowCommunityRanking");
    expect(detailSource).toContain('pool.visibility === "PUBLIC"');
    expect(detailSource).toContain('pool.status === "ARCHIVED"');
    expect(detailSource).toContain("pool.deletedAt !== null");
    expect(detailSource).toContain("communityRankingUnavailable");
    expect(detailSource).toContain("查看个人对决共享榜");
    expect(detailSource).toContain('setWorkspaceMode("community")');
    expect(detailSource).toContain('workspaceMode === "community" && canShowCommunityRanking');
  });

  it("does not require login or play permission before showing public community ranking", () => {
    const expressionStart = detailSource.indexOf("const canShowCommunityRanking");
    const expressionEnd = detailSource.indexOf("const joinedAnimeIds", expressionStart);
    const expression = detailSource.slice(expressionStart, expressionEnd);

    expect(expression).toContain('pool.visibility === "PUBLIC"');
    expect(expression).not.toContain("canPlayPool");
    expect(expression).not.toContain("canManagePool");
  });

  it("loads community ranking through the existing client API and handles 403/404 without raw errors", () => {
    expect(detailSource).toContain("getCommunityRanking(params.poolId)");
    expect(detailSource).toContain("reason instanceof ApiClientError");
    expect(detailSource).toContain("reason.status === 403 || reason.status === 404");
    expect(detailSource).toContain("setCommunityRankingUnavailable(true)");
    expect(detailSource).toContain("社区榜单暂时加载失败，请重试。");
    expect(detailSource).not.toContain("JSON.stringify(communityRanking");
    expect(detailSource).not.toContain("stack");
  });

  it("does not cancel the community ranking request when the loading flag changes", () => {
    const requestStart = detailSource.indexOf("getCommunityRanking(params.poolId)");
    const nextEffectStart = detailSource.indexOf("useEffect(() => {", requestStart);
    const requestEffect = detailSource.slice(requestStart - 600, nextEffectStart);

    expect(requestEffect).toContain("setIsCommunityRankingLoading(true)");
    expect(requestEffect).toContain("setIsCommunityRankingLoading(false)");
    expect(requestEffect).not.toContain("communityRanking !== null || isCommunityRankingLoading");
    expect(requestEffect).not.toContain("isCommunityRankingLoading]");
    expect(requestEffect).toContain("[communityRankingReloadKey, params.poolId, pool, workspaceMode]");
    expect(detailSource).toContain("setCommunityRankingReloadKey((value) => value + 1)");
    expect(detailSource).toContain("重新加载社区榜单");
  });

  it("renders community ranking summary and item metrics from the API payload", () => {
    expect(detailSource).toContain("CommunitySection");
    expect(detailSource).toContain("CommunityAverageTierList");
    expect(detailSource).toContain("ranking.totalParticipants");
    expect(detailSource).toContain("ranking.totalRuns");
    expect(detailSource).toContain("ranking.totalAnime");
    expect(detailSource).toContain("ranking.minSampleThreshold.minUsers");
    expect(detailSource).toContain("ranking.minSampleThreshold.minComparisons");
    expect(detailSource).toContain("ranking.items.map");
    expect(detailSource).toContain("item.communityScore");
    expect(detailSource).toContain("item.averageRating");
    expect(detailSource).toContain("item.participantCount");
    expect(detailSource).toContain("item.comparisonCount");
  });

  it("exports the shared community Tier List through the same image export pipeline", () => {
    expect(detailSource).toContain("buildCommunityTierShareTiers");
    expect(detailSource).toContain("exportShareCardAsPng");
    expect(detailSource).toContain("TierShareCard");
    expect(detailSource).toContain("导出共享 Tier 图");
    expect(detailSource).toContain("tiermaker-export-host");
    expect(detailSource).toContain('id: "community"');
  });

  it("keeps share-card export footer text distinct for community and season exports", () => {
    const shareViewSource = readFileSync("src/components/TierShareView.tsx", "utf8");
    expect(shareViewSource).toContain("普通对决共享榜 · 匿名聚合社区结果");
    expect(shareViewSource).toContain("赛季共享 TierList · 匿名聚合结果");
    expect(shareViewSource).toContain("大乱斗赛季个人 Elo 结果");
  });

  it("shows sufficient ranks and insufficient sample states", () => {
    expect(detailSource).toContain("item.rank !== null");
    expect(detailSource).toContain("#{item.rank}");
    expect(detailSource).toContain("样本不足");
    expect(detailSource).toContain("item.insufficientSample");
    expect(detailSource).toContain("<AppBadge tone=\"warning\">样本不足</AppBadge>");
  });

  it("shows empty and unavailable community ranking states", () => {
    expect(detailSource).toContain("这个番组暂时没有社区榜单");
    expect(detailSource).toContain("还没有足够的社区对决数据。");
    expect(detailSource).toContain("登录后开始对决，也可以帮助这个番组生成社区榜单。");
  });

  it("keeps the community ranking mobile layout card-based rather than table-based", () => {
    const sectionStart = detailSource.indexOf("function CommunitySection");
    const section = sectionStart !== -1
      ? detailSource.slice(sectionStart)
      : detailSource.slice(detailSource.indexOf("function CommunityRankingSection"));

    expect(section).not.toContain("<table");
    expect(section).toContain("grid gap-3");
    expect(section).toContain("sm:grid-cols");
  });

  it("opens the community ranking near the top of the pool workspace", () => {
    const communityRender = detailSource.indexOf('workspaceMode === "community" && canShowCommunityRanking');
    const animeWall = detailSource.indexOf('id="anime-wall"');

    expect(communityRender).toBeGreaterThan(-1);
    expect(animeWall).toBeGreaterThan(-1);
    expect(communityRender).toBeLessThan(animeWall);
    expect(detailSource).toContain('document.getElementById("community-ranking")?.scrollIntoView');
    expect(detailSource).toContain('prefers-reduced-motion: reduce');
  });

  it("adds a low-emphasis Tier page entry to the pool community ranking anchor", () => {
    expect(tierSource).toContain("canShowCommunityRanking");
    expect(tierSource).toContain("isCommunityBattleVisiblePool(pool)");
    expect(tierSource).toContain("#community-ranking");
    expect(tierSource).toContain("查看社区榜单");
    expect(tierSource).toContain('variant: "quiet"');
  });
});
