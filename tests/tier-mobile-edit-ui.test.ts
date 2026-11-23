import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile Tier editing", () => {
  const editorSource = readFileSync("src/components/TierAnimeCard.tsx", "utf8");
  const pageSource = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");

  it("offers touch controls instead of requiring drag and drop", () => {
    expect(editorSource).toContain('[@media(hover:hover)_and_(pointer:fine)]:hidden');
    expect(editorSource).toContain("移动到 Tier");
    expect(editorSource).toContain("min-h-11");
    expect(editorSource).toContain("aria-label={`将 ${title} 移至其他 Tier`}");
  });

  it("supports moving works across tiers and reordering them within a tier", () => {
    expect(pageSource).toContain("function moveAnimeToTier");
    expect(pageSource).toContain("function moveAnimeWithinTier");
    expect(pageSource).toContain("onMoveEarlier={() => moveAnimeWithinTier(row.id, item.animeId, -1)}");
    expect(pageSource).toContain("onMoveLater={() => moveAnimeWithinTier(row.id, item.animeId, 1)}");
  });

  it("keeps desktop drag and drop available", () => {
    expect(editorSource).toContain("draggable={editable && !exportMode}");
    expect(editorSource).toContain("onDropBefore();");
  });
});
