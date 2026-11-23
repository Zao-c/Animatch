import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("AniSong mobile match details", () => {
  const card = readFileSync("src/components/anisong/SongMatchCard.tsx", "utf8");
  const pop = readFileSync("src/components/anisong/SongPlayerPopover.tsx", "utf8");
  it("opens details in a top-layer popover rather than an overlay below the voting card", () => {
    expect(card).toContain('<SongPlayerPopover label="歌曲详情">');
    expect(card).not.toContain('top-full z-20');
  });
  it("positions panels using their actual rendered height and available viewport", () => {
    expect(pop).toContain("p.getBoundingClientRect().height");
    expect(pop).toContain("below + height <= viewportHeight - 12");
    expect(pop).toContain('aria-expanded="false"');
  });
});
