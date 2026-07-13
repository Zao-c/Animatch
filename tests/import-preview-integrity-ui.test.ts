import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("import preview integrity UI", () => {
  const quickImportSource = readFileSync("src/components/QuickImportPanel.tsx", "utf8");
  const poolDetailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");

  it("requires a current quick-import preview before creating a pool", () => {
    expect(quickImportSource).toContain("const [previewParams, setPreviewParams]");
    expect(quickImportSource).toContain("function clearPreviewSelection()");
    expect(quickImportSource).toContain("params: previewParams");
    expect(quickImportSource).toContain("请先预览并确认要创建的作品");
    expect(quickImportSource).toContain("preview !== null && previewParams !== null && selectedIds.size > 0");
  });

  it("invalidates quick-import selections when search-defining controls change", () => {
    expect(quickImportSource).toContain("clearPreviewSelection();\n    setSelectedTags");
    expect(quickImportSource).toContain("clearPreviewSelection();\n                    setMode(m.key)");
    expect(quickImportSource).toContain("clearPreviewSelection();\n                  setYear(e.target.value)");
    expect(quickImportSource).toContain("clearPreviewSelection();\n                  setBangumiUserId(e.target.value)");
  });

  it("imports a TierMaker preview from its immutable preview URL", () => {
    expect(poolDetailSource).toContain("url: tiermakerPreview.sourceUrl");
    expect(poolDetailSource).toContain("setTiermakerPreview(null);");
    expect(poolDetailSource).toContain("setTiermakerSelectedIndexes(new Set());");
  });
});
