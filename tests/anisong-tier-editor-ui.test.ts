import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Anisong tier editor contract", () => {
  const editor = readFileSync("src/components/anisong/SongTierEditor.tsx", "utf8");
  const panel = readFileSync("src/components/anisong/SongTierPanel.tsx", "utf8");
  const service = readFileSync("src/lib/anisong/service.ts", "utf8");
  it("has drag, touch alternatives, undo and explicit save/cancel", () => {
    expect(editor).toContain("draggable=");
    expect(editor).toContain("onDragOver");
    expect(editor).toContain("onDrop");
    expect(editor).toContain("撤销移动");
    expect(editor).toContain("前移");
    expect(editor).toContain("后移");
    expect(editor).toContain("保存排序");
    expect(editor).toContain("取消编辑");
  });
  it("does not share/export an uncommitted draft and preserves revision conflict checks", () => {
    expect(panel).toContain('disabled={disabled || editing}');
    expect(service).toContain('case "tierLayout"');
    expect(service).toContain('case "tierReset"');
    expect(service).toContain('["bulkEdit", "candidateSelection", "candidates", "tierLayout", "tierReset"]');
  });
});
