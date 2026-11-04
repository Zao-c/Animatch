import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AniSong public playlist keyboard and screen reader tabs", () => {
  const detail = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");
  const tabs = readFileSync("src/components/ui/DashboardTabs.tsx", "utf8");
  it("shares existing arrow-key accessible tabs and connects the active tab to the panel", () => {
    expect(detail).toContain('DashboardTabs id="song-public"');
    expect(detail).toContain('id={`song-public-panel-${tab}`}');
    expect(detail).toContain('aria-labelledby={`song-public-tab-${tab}`}');
    expect(tabs).toContain('event.key === "ArrowRight"');
    expect(tabs).toContain('event.key === "ArrowLeft"');
  });
});
