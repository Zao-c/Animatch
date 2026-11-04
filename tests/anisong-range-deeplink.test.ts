import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("personal match range deep links", () => {
  const page = readFileSync("src/app/anisong/[boardId]/page.tsx", "utf8");
  const workspace = readFileSync("src/components/anisong/SongWorkspace.tsx", "utf8");
  const template = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");
  it("opens the range tab directly from match and from published owner view", () => {
    expect(page).toContain('tab === "range"');
    expect(workspace).toContain('boardId + "?tab=range"');
    expect(template).toContain('href={`${ownerHref}?tab=range`}');
  });
  it("shows the saved participant selection when revisiting their range", () => {
    expect(workspace).toContain("setSelectedIds(board.document.candidateIds ?? board.document.tracks.map");
  });
});
