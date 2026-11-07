import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("AppShell navigation", () => {
  const source = readFileSync("src/components/ui/AppShell.tsx", "utf8");

  it("keeps the public pool lobby as the first navigation entry on both layouts", () => {
    expect(source).toContain('{ href: "/pools?view=public", label: "番组大厅" }');
    expect(source).toContain("MAIN_NAV_ITEMS.map((item)");
    expect(source).toContain("<MobileNav items={MAIN_NAV_ITEMS} />");
    expect(source.indexOf("番组大厅")).toBeLessThan(source.indexOf("创建番组"));
  });
});
