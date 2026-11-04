import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("public playlist gallery pagination UX", () => {
  const source = readFileSync("src/components/anisong/SongTemplateGallery.tsx", "utf8");
  it("returns to the gallery rather than scrolling the whole page to the header", () => {
    expect(source).toContain("ref={galleryRef}");
    expect(source).toContain("scrollAfterPage.current = true");
    expect(source).toContain('galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(source).not.toContain("window.scrollTo({ top: 0");
  });
});
