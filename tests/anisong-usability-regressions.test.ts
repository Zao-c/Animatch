import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniSong usability regressions", () => {
  it("opens the real match route after starting a public playlist", () => {
    const source = readFileSync("src/components/anisong/SongTemplateGallery.tsx", "utf8");
    expect(source).toContain('router.push(`/anisong/${board.id}/match`)');
    expect(source).not.toContain('?view=match');
    expect(source).toContain("重试加载");
  });

  it("associates player popovers with triggers and restores focus", () => {
    const source = readFileSync("src/components/anisong/SongPlayerPopover.tsx", "utf8");
    expect(source).toContain("aria-controls={panelId}");
    expect(source).toContain("if (!open && p.contains(document.activeElement)) button?.focus()");
  });
});
