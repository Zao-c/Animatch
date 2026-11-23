import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
describe("large AniSong playlist Quick Match discovery",()=>{
  const source=readFileSync("src/components/anisong/SongWorkspace.tsx","utf8");
  it("offers Quick Match directly from large playlists without deleting existing votes",()=>{
    expect(source).toContain('ranking.active.length >= 128');
    expect(source).toContain('开启快速分档');
    expect(source).toContain('action: "matchMode", mode: "quick"');
    expect(source).toContain('不会清空你的已有投票');
  });
});
