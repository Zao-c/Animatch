import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("public song preview audio boundary", () => {
  const source = readFileSync("src/app/api/anisong/templates/[templateId]/playback/[trackId]/route.ts", "utf8");
  const player = readFileSync("src/components/anisong/SongPlayer.tsx", "utf8");
  it("only serves public pool or iTunes previews for active templates", () => {
    expect(source).toContain("active: true");
    expect(source).toContain('choice !== "pool" && choice !== "itunes"');
    expect(source).not.toContain('requireCurrentUser');
    expect(player).toContain('/api/anisong/templates/${templateId}/playback/');
    expect(player).toContain("templateId && selected === \"original\"");
  });
});
