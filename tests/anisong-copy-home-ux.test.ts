import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniMatch concise copy and mode entrances", () => {
  const home = readFileSync("src/components/HomeActions.tsx", "utf8");
  const detail = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");
  const workspace = readFileSync("src/components/anisong/SongWorkspace.tsx", "utf8");
  const visibility = readFileSync("src/components/anisong/SongVisibilityActions.tsx", "utf8");
  const lobby = readFileSync("src/components/anisong/SongLobby.tsx", "utf8");
  it("offers two prominent, real links without the crowded old CTA row", () => {
    expect(home).toContain('aria-label="选择对决类型"');
    expect(home).toContain('href="/pools?view=public"');
    expect(home).toContain('href="/anisong"');
    expect(home).toContain(">动画对决</Link>");
    expect(home).toContain(">音乐对决</Link>");
  });
  it("keeps controls and copyright permissions while removing repeated descriptions", () => {
    expect(detail).not.toContain("版本 {template.revision}");
    expect(detail).not.toContain("试听请点击");
    expect(detail).not.toContain("参加后独立保存");
    expect(detail).toContain("SongPlayer");
    expect(detail).toContain("开始 / 继续对决");
    expect(visibility).not.toContain("公开曲单 · 可通过网址访问");
    expect(visibility).toContain("<SongShareButton");
    expect(visibility).toContain("设为私人");
    expect(workspace).not.toContain("分享曲单只复制网址");
    expect(lobby).not.toContain("page.description");
    const publisher = readFileSync("src/components/anisong/SongTemplatePublisher.tsx", "utf8");
    expect(publisher).toContain("我确认有权");
  });
  it("keeps visibility changes in settings rather than the primary action area", () => {
    expect(workspace).toContain("showToggle={false}");
    expect(workspace).toContain("公开与分享");
  });
});
