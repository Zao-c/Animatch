import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pool management UI", () => {
  const poolsSource = readFileSync("src/app/pools/page.tsx", "utf8");
  const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
  const newPoolSource = readFileSync("src/app/pools/new/page.tsx", "utf8");
  const poolLabelsSource = readFileSync("src/lib/pool-labels.ts", "utf8");

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
    expect(poolsSource).toContain("番组设置");
    expect(poolsSource).toContain("归档番组");
    expect(poolsSource).toContain("恢复番组");
    expect(poolsSource).toContain("复制番组 ID");
  });

  it("offers demo pool onboarding from the empty state", () => {
    expect(poolsSource).toContain("体验示例番组");
    expect(poolsSource).toContain("正在准备体验池...");
    expect(poolsSource).toContain("createDemoPool");
  });

  it("adds cover memory points to pool cards", () => {
    expect(poolsSource).toContain("CoverStrip");
    expect(poolsSource).toContain("coverImages");
  });

  it("renders pool card visibility labels without question-mark placeholders", () => {
    const apiSource = readFileSync("src/app/api/pools/route.ts", "utf8");

    expect(poolsSource).toContain("formatPoolVisibility(pool.visibility)");
    expect(poolsSource).toContain("formatOfficialDemo(pool.isOfficialDemo)");
    expect(apiSource).not.toContain('return "???"');
    expect(apiSource).not.toContain('return "?????"');
  });

  it("offers owner visibility editing from the pool detail settings panel", () => {
    expect(detailSource).toContain("可见性");
    expect(detailSource).toContain("POOL_VISIBILITY_OPTIONS");
    expect(poolLabelsSource).toContain("只有你能查看和对决");
    expect(poolLabelsSource).toContain("知道链接的人可以浏览，登录后可以开始自己的个人对决");
    expect(poolLabelsSource).toContain("会出现在公开番组页，登录后任何人都可以开始自己的个人对决");
  });

  it("keeps the pool detail settings entry owner-only", () => {
    expect(detailSource).toContain("const canManagePool = permissions?.canManage ?? false");
    expect(detailSource).toContain("{canManagePool ? (");
    expect(detailSource).toContain('{workspaceMode === "settings" && canManagePool ? (');
    expect(detailSource).toContain("更多番组操作");
    expect(detailSource).toContain("番组设置");
    expect(detailSource).not.toContain("编辑番组");
  });

  it("renders disabled reserved public permission controls", () => {
    expect(detailSource).toContain("公开协作设置");
    expect(detailSource).toContain("允许其他人添加动画");
    expect(detailSource).toContain("启用大乱斗公共榜单");
    expect(detailSource).toContain("体验番组会作为开放样板池，允许所有登录用户协作编辑。普通公开番组的协作开关暂未开放。");
    expect(detailSource).toContain('type="checkbox" disabled');
  });

  it("does not submit reserved public permission fields from the settings panel", () => {
    const updateStart = detailSource.indexOf("const updated = await updatePool");
    const updateEnd = detailSource.indexOf("});", updateStart);
    const updatePayload = detailSource.slice(updateStart, updateEnd);

    expect(updatePayload).toContain("visibility: editVisibility");
    expect(updatePayload).not.toContain("allowPublicEdit");
    expect(updatePayload).not.toContain("allowCommunityMatch");
  });

  it("updates the detail badge from the saved pool visibility", () => {
    expect(detailSource).toContain("{isArchived ? \"已归档\" : formatPoolVisibility(pool.visibility)}");
    expect(detailSource).toContain("setPool((current) => (current === null ? current : { ...current, ...updated }))");
  });

  it("turns pool creation into an onboarding flow", () => {
    expect(newPoolSource).toContain("创建你的动画池");
    expect(newPoolSource).toContain("创建并添加动画");
    expect(newPoolSource).toContain("#add-anime");
    expect(newPoolSource).toContain("四月新番");
    expect(newPoolSource).toContain("添加动画后开始对决");
  });

  it("shows archived pools as read-only on detail while keeping restore available", () => {
    expect(detailSource).toContain("这个番组已归档，只能查看，不能继续添加或对决。");
    expect(detailSource).toContain("恢复后你可以继续添加动画和对决。");
    expect(detailSource).toContain("恢复番组");
    expect(detailSource).toContain("归档番组不能继续添加动画。");
  });

  it("shows the TierMaker import assistant in the TierMaker tab", () => {
    expect(detailSource).toContain("复制导入助手脚本");
    expect(detailSource).toContain("TierMaker 导入助手");
    expect(detailSource).toContain("图片 URL 列表");
    expect(detailSource).toContain("可选：自动解析模板链接");
  });

  it("shows pool readiness check for owners", () => {
    expect(detailSource).toContain("PoolReadinessCard");
    expect(detailSource).toContain("poolReadiness");
    expect(detailSource).toContain("buildPoolReadinessReport");
    expect(detailSource).toContain("canManagePool && !isArchived");
  });

  it("uses an inspector workspace for add and display editing", () => {
    expect(detailSource).toContain("type PoolWorkspaceMode");
    expect(detailSource).toContain('setWorkspaceMode("add")');
    expect(detailSource).toContain('setWorkspaceMode("edit")');
    expect(detailSource).toContain('value === "cover" ? null : "cover"');
    expect(detailSource).toContain('value === "community" ? null : "community"');
    expect(detailSource).toContain('id="add-anime"');
    expect(detailSource).toContain("fixed inset-x-0 bottom-0");
    expect(detailSource).toContain("lg:sticky lg:top-24");
    expect(detailSource).toContain('workspaceMode === "cover" && canEditContent');
    expect(detailSource).toContain("修复封面");
    expect(detailSource).toContain('workspaceMode === "community" && canShowCommunityRanking');
    expect(detailSource).toContain("compact?: boolean");
  });

  it("community ranking loads only when workspaceMode community is active", () => {
    expect(detailSource).toContain('if (workspaceMode !== "community")');
    expect(detailSource).toContain("return");
  });

  it("exposes tier row editing and passes custom rows to community tier wall", () => {
    expect(detailSource).toContain("PoolTierConfigEditor");
    expect(detailSource).toContain("updatePoolTierConfig");
    expect(detailSource).toContain("handleSaveTierConfig");
    expect(detailSource).toContain("tierRows={pool?.tierConfig?.rows ?? null}");
    expect(detailSource).toContain("resolvedTierRows");
    expect(detailSource).toContain("tierRows={resolvedTierRows}");
  });

  it("saves tier config with the current pool update token", () => {
    const tierPageSource = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");
    const clientApiSource = readFileSync("src/lib/client-api.ts", "utf8");
    const routeSource = readFileSync("src/app/api/pools/[poolId]/tier-config/route.ts", "utf8");

    expect(detailSource).toContain("updatePoolTierConfig(pool.id, config, pool.updatedAt)");
    expect(tierPageSource).toContain("poolUpdatedAt");
    expect(tierPageSource).toContain("updatePoolTierConfig(params.poolId, config, poolUpdatedAt)");
    expect(clientApiSource).toContain("expectedUpdatedAt");
    expect(routeSource).toContain("where: { id: pool.id, updatedAt: expectedUpdatedAt }");
    expect(routeSource).toContain("return conflict");
  });

  it("has batch management mode with toggle", () => {
    expect(detailSource).toContain("batchMode");
    expect(detailSource).toContain("selectedAnimeIds");
    expect(detailSource).toContain("批量管理");
    expect(detailSource).toContain("取消批量管理");
    expect(detailSource).toContain("移出 ");
  });

  it("has search and filter controls on the anime wall", () => {
    expect(detailSource).toContain("搜索当前作品...");
    expect(detailSource).toContain("animeWallSearch");
    expect(detailSource).toContain("animeWallFilter");
    expect(detailSource).toContain("sm:grid-cols-[minmax(16rem,1fr)_12rem]");
    expect(detailSource).toContain("缺封面");
    expect(detailSource).toContain("疑似脏标题");
    expect(detailSource).toContain("TierMaker 导入");
    expect(detailSource).toContain("Custom 上传");
  });

  it("offers a one-click pool share action", () => {
    expect(detailSource).toContain("handleCopyPoolShare");
    expect(detailSource).toContain("AniMatch 番组《");
    expect(detailSource).toContain("打开后登录即可开始对决。");
    expect(detailSource).toContain("分享番组");
    expect(detailSource).toContain("已复制番组分享链接。");
  });

  it("has batch confirmation dialog", () => {
    expect(detailSource).toContain("batchConfirmOpen");
    expect(detailSource).toContain("确认移出作品");
    expect(detailSource).toContain("将从当前番组中移出");
    expect(detailSource).toContain("不会删除全局作品数据");
    expect(detailSource).toContain("确定移出");
  });

  it("disables batch remove button when nothing selected", () => {
    expect(detailSource).toContain("selectedAnimeIds.size === 0");
  });

  it("hides edit/remove buttons in batch mode", () => {
    expect(detailSource).toContain("canManage && !batchMode");
    expect(detailSource).toContain("isBatchSelected");
    expect(detailSource).toContain("onToggleBatchSelect");
    expect(detailSource).toContain('type="checkbox"');
  });

  it("calls batchRemoveAnimeFromPool in the handler", () => {
    expect(detailSource).toContain("batchRemoveAnimeFromPool");
    expect(detailSource).toContain("handleBatchRemove");
    expect(detailSource).toContain("Array.from(selectedAnimeIds)");
  });

  it("resets batch state and refreshes after batch remove success", () => {
    expect(detailSource).toContain("setSelectedAnimeIds(new Set())");
    expect(detailSource).toContain("setBatchMode(false)");
    expect(detailSource).toContain("setBatchConfirmOpen(false)");
  });
});
