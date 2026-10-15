import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("season section resilience", () => {
  const source = readFileSync("src/components/PoolSeasonsSection.tsx", "utf8");

  it("keeps a visible retry action when season loading fails", () => {
    expect(source).toContain("const [loadError, setLoadError]");
    expect(source).toContain("onClick={load}");
  });
});
