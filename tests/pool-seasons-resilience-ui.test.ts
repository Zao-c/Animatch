import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("season section resilience", () => {
  const source = readFileSync("src/components/PoolSeasonsSection.tsx", "utf8");

  it("keeps a visible retry action when season loading fails", () => {
    expect(source).toContain("const [loadError, setLoadError]");
    expect(source).toContain("赛季暂时加载失败，请重新加载。");
    expect(source).toContain("重新加载赛季");
    expect(source).toContain("onClick={load}");
  });
});
