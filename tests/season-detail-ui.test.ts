import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("season detail UI", () => {
  const source = readFileSync(
    "src/app/pools/[poolId]/seasons/[seasonId]/page.tsx",
    "utf8"
  );

  it("uses a wider desktop canvas for shared rankings", () => {
    expect(source).toContain("max-w-6xl");
    expect(source).not.toContain("mx-auto max-w-4xl px-4 py-8");
  });

  it("keeps shared tier rows visually light", () => {
    expect(source).toContain("grid-cols-[56px_1fr]");
    expect(source).toContain("bg-white/[0.035]");
    expect(source).toContain("rounded-xl text-base font-extrabold");
  });

  it("renders larger tier cards for readable covers", () => {
    expect(source).toContain("w-28 rounded-xl");
    expect(source).toContain("sm:w-32");
    expect(source).toContain("h-32 w-full rounded-lg sm:h-36");
  });

  it("offers a one-click season share action", () => {
    expect(source).toContain("handleCopySeasonShare");
    expect(source).toContain("AniMatch 大乱斗赛季《");
    expect(source).toContain("打开后登录即可开始对决。");
    expect(source).toContain("分享赛季");
    expect(source).toContain("已复制赛季分享链接。");
  });

  it("shows personal season results before shared aggregation", () => {
    expect(source).toContain("个人赛季结果");
    expect(source).toContain("我的赛季 Tier List");
    expect(source).toContain("SeasonPersonalTierCard");
    expect(source).toContain("只根据你在这个赛季里的个人 Elo 排序");
    expect(source).toContain("它和下方多人聚合的赛季共享榜单分开计算");
  });

  it("exports personal and shared season tier images through the existing share-card pipeline", () => {
    expect(source).toContain("exportShareCardAsPng");
    expect(source).toContain("TierShareCard");
    expect(source).toContain("personalExportRef");
    expect(source).toContain("sharedExportRef");
    expect(source).toContain("导出我的赛季图");
    expect(source).toContain("导出共享赛季图");
    expect(source).toContain("buildPersonalSeasonShare");
    expect(source).toContain("buildSharedSeasonShare");
    expect(source).toContain("tiermaker-export-host");
  });

  it("keeps season load failures retryable without replacing loaded detail content", () => {
    expect(source).toContain("setLoading(true);");
    expect(source).toContain("setError(null);");
    expect(source).toContain("error && detail === null");
    expect(source).toContain("onClick={fetchDetail}");
    expect(source).toContain("loading && detail === null");
  });

  it("derives the visible season state from schedule dates before offering a match", () => {
    expect(source).toContain("getSeasonDisplayState");
    expect(source).toContain("投票已截止");
    expect(source).toContain("seasonState.canVote");
    expect(source).toContain("只在共享榜单聚合时加成");
    expect(source).toContain("加成票模式");
  });

  it("lets managers configure opening and deadline times with local datetime inputs", () => {
    expect(source).toContain("type=\"datetime-local\"");
    expect(source).toContain("toDateTimeLocalInputValue(detail.startsAt)");
    expect(source).toContain("dateTimeLocalToIso(editForm.startsAt)");
    expect(source).toContain("editForm.endsAt.trim() === \"\" ? null");
  });

  it("labels draft activation as publishing so a scheduled opening is not implied to start immediately", () => {
    expect(source).toContain("发布赛季");
  });

  it("keeps season context and key result sections reachable on long pages", () => {
    expect(source).toContain('aria-label="赛季页面导航"');
    expect(source).toContain('href="#season-results"');
    expect(source).toContain('href="#season-impact"');
    expect(source).toContain('id="season-results"');
    expect(source).toContain('id="season-impact"');
  });
});
