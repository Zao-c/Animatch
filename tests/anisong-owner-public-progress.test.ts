import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("music playlist owner progress routing", () => {
  const summary = readFileSync("src/lib/anisong/shared/templates.ts", "utf8");
  const gallery = readFileSync("src/components/anisong/SongTemplateGallery.tsx", "utf8");
  const detail = readFileSync("src/components/anisong/SongTemplateDetail.tsx", "utf8");
  it("exposes source board ID to its owner only", () => {
    expect(summary).toContain("template.ownerId === userId && template.sourceBoardId");
  });
  it("routes creators into the source board instead of making a second run", () => {
    expect(gallery).toContain("template.mine && template.ownerBoardId");
    expect(detail).toContain("template.mine && template.ownerBoardId");
    expect(detail).toContain("继续我的对决");
  });
});
