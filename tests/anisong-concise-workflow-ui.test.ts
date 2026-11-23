import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniSong concise interaction hierarchy", () => {
  const match = readFileSync("src/components/anisong/SongMatchPanel.tsx", "utf8");
  const workspace = readFileSync("src/components/anisong/SongWorkspace.tsx", "utf8");
  const tier = readFileSync("src/components/anisong/SongTierPanel.tsx", "utf8");

  it("keeps mode selection prominent without a second explainer card", () => {
    expect(match).toContain('aria-label="对决模式"');
    expect(match).toContain("aria-pressed={isQuick}");
    expect(match).toContain("基础覆盖 {quick.covered}/{quick.total} 首");
    expect(match).toContain("进度说明");
    expect(match).not.toContain("进度与榜单说明");
    expect(match).not.toContain("正在优先覆盖未充分比较的歌曲");
    expect(match).toContain('onVote("LEFT_UNSEEN")');
    expect(match).toContain("不代表排名准确度");
  });

  it("offers Quick Match as a secondary shortcut beside the main action", () => {
    expect(workspace).toContain('ranking.active.length >= 128 && board.document.matchMode !== "quick"');
    expect(workspace).toContain('action: "matchMode", mode: "quick"');
    expect(workspace).toContain("不会清空你的已有投票");
    expect(workspace).toContain("继续音乐对决");
    expect(workspace).not.toContain("年度大曲单 · 快速分档");
    expect(workspace).not.toContain("建议约 {Math.ceil(ranking.active.length * 1.65)} 场");
  });

  it("leaves public sharing upfront and technical export under a disclosure", () => {
    expect(tier).toContain("分享与导出");
    expect(tier).toContain("更多导出");
    expect(tier.indexOf("更多导出")).toBeLessThan(tier.indexOf("导出 JSON"));
    expect(tier).toContain('onClick={onPublish}');
    expect(tier).toContain('onClick={onUnpublish}');
    expect(tier).toContain('onClick={onExportPng}');
    expect(tier).toContain("不包含音频");
    expect(tier).not.toContain("图片与分享快照按已保存的排序生成");
  });
});
