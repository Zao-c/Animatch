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
    expect(detailSource).toContain("{showMorePoolActions && canManagePool ? (");
    expect(detailSource).toContain("更多番组操作");
    expect(detailSource).toContain("番组设置");
    expect(detailSource).not.toContain("编辑番组");
  });

  it("renders disabled reserved public permission controls", () => {
    expect(detailSource).toContain("公开权限，暂未开放");
    expect(detailSource).toContain("允许其他人添加动画");
    expect(detailSource).toContain("启用大乱斗公共榜单");
    expect(detailSource).toContain("这些功能还在设计中，当前公开番组只支持他人浏览并进行个人对决。");
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
    expect(newPoolSource).toContain("添加 4-8 部动画");
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
});
