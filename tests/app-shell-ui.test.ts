import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("AppShell navigation", () => {
  const source = readFileSync("src/components/ui/AppShell.tsx", "utf8");

  it("keeps the public pool lobby as a first-level navigation entry", () => {
    expect(source).toContain('<NavLink href="/pools?view=public">番组大厅</NavLink>');
    expect(source.indexOf("番组大厅")).toBeLessThan(source.indexOf("创建番组"));
  });
});
