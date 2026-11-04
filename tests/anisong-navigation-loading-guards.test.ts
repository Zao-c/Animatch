import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniSong library accessibility and stale-data recovery", () => {
  const workspace = readFileSync("src/components/anisong/SongWorkspace.tsx", "utf8");
  const gallery = readFileSync("src/components/anisong/SongTemplateGallery.tsx", "utf8");
  const version = readFileSync("src/components/anisong/SongVersionUpdateNotice.tsx", "utf8");

  it("activates the focused library tab with arrow keys, including on mobile", () => {
    expect(workspace).toContain('id="song-library-tabs" role="tablist"');
    expect(workspace).toContain("overflow-x-auto");
    expect(workspace).toContain("shrink-0 whitespace-nowrap");
    expect(workspace).toContain("data-song-library-tab={id}");
    expect(workspace).toContain("const nextTab = target?.dataset.songLibraryTab");
    expect(workspace).toContain("switchLibraryTab(nextTab)) target.focus()");
    expect(workspace).toContain('if (!window.confirm("放弃尚未保存的曲单名称？")) return false;');
    expect(workspace).toContain('aria-selected={libraryTab === id}');
    expect(workspace).toContain('aria-controls="song-library-panel"');
  });

  it("does not show stale playlist cards after a failed query or page fetch", () => {
    expect(gallery).toContain("const [loadError, setLoadError]");
    expect(gallery).toContain("const [actionError, setActionError]");
    expect(gallery).toContain("loading ? <p");
    expect(gallery).toContain(": loadError ? null : templates.length ?");
    expect(gallery).toContain('setLoadError(cause instanceof Error');
    expect(gallery).toContain('setActionError(cause instanceof Error');
    expect(gallery).toContain("重试加载");
    expect(gallery).toContain("当前页没有曲单");
    expect(gallery).toContain("查看曲单</Link>");
    expect(gallery).toContain("进入对决");
  });

  it("does not reuse an outdated revision when template update checks fail", () => {
    expect(version).toContain('setPreview(null);setLoading(true);setError("")');
    expect(version).toContain("if(!board.templateId || loading ||");
    expect(version).toContain('error&&!preview?"检查曲单更新失败"');
    expect(version).toContain("无法确认公开曲单版本");
    expect(version).toContain("includeNew");
    expect(version).toContain("历史记录不删除");
  });
});
