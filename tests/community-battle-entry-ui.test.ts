import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isCommunityBattleVisiblePool } from "../src/lib/community-battle-visibility";

describe("community battle entry UI wiring", () => {
  const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
  const matchSource = readFileSync(
    "src/app/pools/[poolId]/runs/[runId]/match/page.tsx",
    "utf8"
  );
  const tierSource = readFileSync(
    "src/app/pools/[poolId]/runs/[runId]/tier/page.tsx",
    "utf8"
  );
  const helperSource = readFileSync("src/lib/community-battle-visibility.ts", "utf8");

  it("treats public draft and active pools as visible community battle pools", () => {
    expect(
      isCommunityBattleVisiblePool({
        visibility: "PUBLIC",
        status: "DRAFT",
        deletedAt: null
      })
    ).toBe(true);
    expect(
      isCommunityBattleVisiblePool({
        visibility: "PUBLIC",
        status: "ACTIVE",
        deletedAt: null
      })
    ).toBe(true);
  });

  it("hides private, unlisted, archived, and deleted community battle pools", () => {
    expect(
      isCommunityBattleVisiblePool({
        visibility: "PRIVATE",
        status: "DRAFT",
        deletedAt: null
      })
    ).toBe(false);
    expect(
      isCommunityBattleVisiblePool({
        visibility: "UNLISTED",
        status: "DRAFT",
        deletedAt: null
      })
    ).toBe(false);
    expect(
      isCommunityBattleVisiblePool({
        visibility: "PUBLIC",
        status: "ARCHIVED",
        deletedAt: null
      })
    ).toBe(false);
    expect(
      isCommunityBattleVisiblePool({
        visibility: "PUBLIC",
        status: "DRAFT",
        deletedAt: "2026-06-16T00:00:00.000Z"
      })
    ).toBe(false);
  });

  it("shows public pool community battle entry with anonymous and logged-in copy", () => {
    expect(detailSource).toContain("const canShowCommunityBattle");
    expect(detailSource).toContain("isCommunityBattleVisiblePool(pool)");
    expect(detailSource).toContain("登录后自由对决");
    expect(detailSource).toContain("个人自由对决");
    expect(detailSource).toContain("每个人的对决");
    expect(detailSource).toContain("社区榜单会聚合每个人的对决结果");
    expect(detailSource).toContain("不影响创建者的作品墙");
    expect(detailSource).toContain("不影响创建者的作品墙或你的个人 Tier List");
  });

  it("shows the public pool privacy copy for community battle", () => {
    expect(detailSource).toContain("口味对照会展示玩家昵称");
  });

  it("hides the community battle entry for non-public, archived, and deleted pools", () => {
    expect(helperSource).toContain('pool.visibility === "PUBLIC"');
    expect(helperSource).toContain('pool.status !== "ARCHIVED"');
    expect(helperSource).toContain("pool.deletedAt == null");
    expect(helperSource).not.toContain('pool.status === "ACTIVE"');
    expect(detailSource).toContain('pool.status === "ARCHIVED"');
    expect(detailSource).toContain('pool.status === "DELETED"');
    expect(detailSource).toContain("pool.deletedAt !== null");
  });

  it("uses login for anonymous readers and the existing default-run match route for players", () => {
    expect(detailSource).toContain("canPromptLoginToBattle");
    expect(detailSource).toContain("router.push(loginToPoolPath)");
    expect(detailSource).toContain("getOrCreateDefaultRun(params.poolId)");
    expect(detailSource).toContain('enterRun("match")');
    expect(detailSource).toContain('`/pools/${params.poolId}/runs/${result.run.id}/${target}`');
  });

  it("keeps owner participation separate from management controls", () => {
    const expressionStart = detailSource.indexOf("const canShowCommunityBattle");
    const expressionEnd = detailSource.indexOf("const loginToPoolPath", expressionStart);
    const expression = detailSource.slice(expressionStart, expressionEnd);

    expect(expression).not.toContain("canManagePool");
    expect(detailSource).toContain("更多番组操作");
    expect(detailSource).toContain("{canManagePool ? (");
    expect(detailSource).toContain("编辑、导入和归档仍只有创建者可以操作");
  });

  it("keeps previous personal run actions and community ranking entry available", () => {
    expect(detailSource).toContain("开始我的对决");
    expect(detailSource).toContain("开始对决");
    expect(detailSource).toContain("查看对决榜单");
    expect(detailSource).toContain("直接制作 Tier List");
    expect(detailSource).toContain("查看个人对决共享榜");
    expect(detailSource).toContain("返回我的番组");
  });

  it("shows a public community battle hint on the Match page through the shared visibility helper", () => {
    expect(matchSource).toContain("const [canShowCommunityBattle");
    expect(matchSource).toContain("isCommunityBattleVisiblePool(pool)");
    expect(matchSource).toContain("CommunityBattleMatchHint");
    expect(matchSource).toContain("你正在参与这个公开番组的社区大乱斗");
    expect(matchSource).toContain("你的选择会更新个人榜单并匿名汇入社区榜");
    expect(matchSource).toContain("口味对照还会展示玩家昵称");
  });

  it("shows a public community contribution hint on the Tier page while preserving the ranking link", () => {
    expect(tierSource).toContain("canShowCommunityRanking");
    expect(tierSource).toContain("isCommunityBattleVisiblePool(pool)");
    expect(tierSource).toContain("这是你的个人榜单；它会匿名汇入社区榜");
    expect(tierSource).toContain("查看社区榜单");
    expect(tierSource).toContain("#community-ranking");
  });

  it("keeps community battle CTA and hints wrapped for a 390px viewport", () => {
    for (const source of [detailSource, matchSource, tierSource]) {
      expect(source).not.toContain("<table");
      expect(source).toContain("min-w-0");
      expect(source).toContain("flex flex-wrap");
      expect(source).not.toMatch(/\b(?:w|mini?-w)-screen\b/);
      expect(source).not.toMatch(/(?:w|mini?-w)-\[1264px\]/);
    }
  });
});
