import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public pools information density", () => {
  const source = readFileSync("src/app/pools/page.tsx", "utf8");

  it("avoids restating the default filter and duplicate playable totals", () => {
    expect(source).toContain('playableCount < pools.length');
    expect(source).not.toContain('筛选 {FILTERS.find((item) => item.value === filter)?.label ?? "全部"}');
    expect(source).toContain('筛选与排序');
    expect(source).not.toContain('筛选与排序 · {viewCopy.title}');
    expect(source).toContain('sort !== "UPDATED"');
  });

  it("keeps search and filter controls functional with a compact summary", () => {
    expect(source).toContain('role="search"');
    expect(source).toContain('onSubmit={handleSearch}');
    expect(source).toContain('onChange={(event) => handleViewChange(event.target.value as PoolView)}');
    expect(source).toContain('onChange={(event) => updateListParams({ status: event.target.value === "ALL" ? undefined : event.target.value })}');
    expect(source).toContain('onChange={(event) => updateListParams({ sort: event.target.value === "UPDATED" ? undefined : event.target.value })}');
  });
});
