import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
describe("community algorithm preview UX",()=>{
  const s=readFileSync("src/components/anisong/SongCommunityRanking.tsx","utf8");
  it("keeps the old scoreboard by default while allowing a clear experiment preview",()=>{
    expect(s).toContain('useState<"official" | "preview">("official")');
    expect(s).toContain('?algorithm=bt-preview');
    expect(s).toContain("正式社区榜");
    expect(s).toContain("新算法预览");
    expect(s).toContain("正式社区排名未修改");
    expect(s).toContain("aria-pressed");
  });
});
