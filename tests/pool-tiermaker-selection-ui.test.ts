import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("TierMaker preview selection", () => {
  const source = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
  const selectionStart = source.indexOf("const isSelected = tiermakerSelectedIndexes.has(item.sourceIndex)");
  const selectionEnd = source.indexOf("tiermakerPreview.items.length > 50", selectionStart);
  const selection = source.slice(selectionStart, selectionEnd);

  it("uses one native checkbox interaction instead of an outer click handler plus checkbox", () => {
    expect(selection).toContain("<label");
    expect(selection).toContain('type="checkbox"');
    expect(selection).toContain("onChange={() => toggleTiermakerItem(item.sourceIndex)}");
    expect(selection).not.toContain('role="button"');
    expect(selection).not.toContain("onClick={() => toggleTiermakerItem(item.sourceIndex)}");
  });
});
