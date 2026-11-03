import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("public music playlist usability", () => {
  const detail = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");
  it("lets visitors search titles, artists and anime and filter large lists", () => {
    expect(detail).toContain('aria-label="搜索歌曲、歌手或所属动画"');
    expect(detail).toContain('aria-label="筛选歌曲类型"');
    expect(detail).toContain("filteredTracks.slice(0, visibleLimit)");
    expect(detail).toContain("setVisibleLimit(value => value + 48)");
  });
  it("scrolls header shortcuts to the target panel after switching sections", () => {
    expect(detail).toContain("tabsRef.current?.scrollIntoView");
    expect(detail).toContain('aria-controls="song-public-tab-panel"');
  });
  it("does not offer an inert source-setting panel before the user can actually play", () => {
    expect(detail).not.toContain("<SongPlaybackPreferences");
    expect(detail).toContain("试听请点击");
  });
});
