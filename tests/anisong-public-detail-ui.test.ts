import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("public song wall matches anime pagination UX", () => {
  const code = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");
  it("limits to 12 songs per page and supports true previous-next navigation", () => {
    expect(code).toContain("const SONGS_PER_PAGE = 12");
    expect(code).toContain("pageTracks = filteredTracks.slice");
    expect(code).toContain("上一页");
    expect(code).toContain("下一页");
    expect(code).not.toContain("再显示 48 首");
  });
  it("auditions approved public audio and allows participant-only range selection", () => {
    expect(code).toContain("templateId={templateId} minimal");
    expect(code).toContain('aria-label={`选择参赛:${track.title}`}').toBe(false); // spacing in the accessible label
    expect(code).toContain("setSelectedIds");
    expect(code).toContain("仅影响我的对决，不修改公共曲单");
  });
});
