import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("personal music library card metadata", () => {
  const code = readFileSync("src/components/anisong/SongWorkspace.tsx", "utf8");
  it("shows the anime name on song cards without forcing people into the details drawer", () => {
    expect(code).toContain('title={track.anime || "动画来源未填写"}');
    expect(code).toContain('track.anime || (track.kind === "OTHER" ? "音乐曲目" : "动画来源未填写")');
  });
});
