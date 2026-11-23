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
  it("labels removing a personal run as an exit without implying source deletion", () => {
    expect(code).toContain("退出参与（仅删除我的进度）");
    expect(code).toContain("不会修改或删除发布者的原曲单");
  });
});
