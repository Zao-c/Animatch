import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SongItunesSearch } from "@/components/anisong/SongItunesSearch";
import { SongNeteaseSearch } from "@/components/anisong/SongNeteaseSearch";

describe("AniSong library focuses on the next user action", () => {
  const workspace = readFileSync("src/components/anisong/SongWorkspace.tsx", "utf8");
  const lobby = readFileSync("src/components/anisong/SongLobby.tsx", "utf8");

  it("places entry and candidates ahead of settings and public publishing", () => {
    expect(workspace).toContain("＋ 添加歌曲");
    expect(workspace).toContain("选择参与对决的歌曲");
    expect(workspace).toContain("继续音乐对决");
    expect(workspace).toContain('variant="primary" size="lg" className="w-full"');
    expect(workspace).toContain('libraryTab === "range"');
    expect(workspace).toContain('libraryTab === "settings"');
    expect(workspace).not.toContain("准备好就开始对决");
    expect(workspace.indexOf("选择参与对决的歌曲")).toBeLessThan(workspace.indexOf("曲单设置与公共发布"));
    expect(workspace.indexOf("曲单设置与公共发布")).toBeLessThan(workspace.indexOf("<SongTemplatePublisher board={board}"));
    expect(lobby).toContain("创建自己的音乐曲单");
    expect(lobby).not.toContain("创建与发布曲单");
  });

  it("renders only the selected platform search and keeps existing import tools", () => {
    expect(workspace).toContain('addMode === "netease" && <SongNeteaseSearch');
    expect(workspace).toContain('addMode === "itunes" && <SongItunesSearch');
    expect(workspace).toContain("addOpen && batchOpen && <SongBatchImport");
    expect(workspace).toContain('addOpen || editing || itunesTarget || detailId');
    const drawerStart = workspace.indexOf('<SongEditDrawer title=');
    const drawerEnd = workspace.indexOf('</SongEditDrawer>', drawerStart);
    for (const task of ['<SongNeteaseSearch', '<SongItunesSearch', '<SongBatchImport', '<SongForm']) {
      expect(workspace.indexOf(task, drawerStart)).toBeGreaterThan(drawerStart);
      expect(workspace.indexOf(task, drawerStart)).toBeLessThan(drawerEnd);
    }
    expect(workspace).not.toContain('歌曲信息与管理');
    expect(workspace).not.toContain('window.scrollTo');
    expect(workspace).toContain("<SongForm boardId={boardId}");
    expect(workspace).not.toContain('editTrack(track); window.scrollTo');
    expect(workspace).toContain("itunesTarget && board.document.tracks.find");
    expect(workspace).toContain("切换添加方式会放弃尚未保存的输入");
  });

  it("opens platform search directly when launched from the single add-song entry", () => {
    const itunes = renderToStaticMarkup(createElement(SongItunesSearch, {
      initialOpen: true, disabled: false, onSelect: async () => true
    }));
    expect(itunes).toContain("iTunes 搜索关键词");
    const netease = renderToStaticMarkup(createElement(SongNeteaseSearch, {
      initialOpen: true, disabled: false, tracks: [], onSave: async () => true
    }));
    expect(netease).toContain("网易云搜索关键词");
  });
});
