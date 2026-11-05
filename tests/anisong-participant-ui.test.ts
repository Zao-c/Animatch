import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("participant versus publisher music UI", () => {
  const code = readFileSync("src/components/anisong/SongWorkspace.tsx", "utf8");
  it("hides source management and publication controls for participants", () => {
    expect(code).toContain("!board.templateId && <AppButton");
    expect(code).toContain("!board.templateId && (board.document.tracks.length");
    expect(code).toContain("libraryTab === \"settings\" && !board.templateId");
    expect(code).toContain("!board.templateId && <AppButton data-song-manage");
  });
  it("exposes restore actions for past unheard songs without granting editing rights", () => {
    expect(code).toContain('board.templateId && score?.isHidden && <AppButton');
    expect(code).toContain('onClick={() => void mutate({ action: "restore", trackId: track.id })}');
    expect(code).toContain('{excluded ? "取消未听过" : "恢复参赛"}');
    expect(code).toContain('!board.templateId && <AppButton data-song-manage');
    expect(code).toContain('disabled={disabled}');
  });
  it("sends participants who cannot start to their range settings rather than song editing", () => {
    const lobby = readFileSync("src/components/anisong/SongLobby.tsx", "utf8");
    expect(lobby).toContain('item.templateId ? `/anisong/${item.id}?tab=range`');
    expect(lobby).toContain('item.templateId ? "调整参赛范围" : "完善歌曲"');
    expect(lobby).toContain("查看曲单</Link>");
  });
  it("offers an abortable reload when the personal playlist list fails", () => {
    const lobby = readFileSync("src/components/anisong/SongLobby.tsx", "utf8");
    expect(lobby).toContain("setLoading(true); setError(\"\"); setLogin(false)");
    expect(lobby).toContain('}, [retryKey]);');
    expect(lobby).toContain("setRetryKey(key => key + 1)");
    expect(lobby).toContain("重新加载");
    expect(lobby).toContain("return () => controller.abort()");
  });
  it("labels removing a personal run as an exit without implying source deletion", () => {
    expect(code).toContain("退出参与（仅删除我的进度）");
    expect(code).toContain("不会修改或删除发布者的原曲单");
  });
});
