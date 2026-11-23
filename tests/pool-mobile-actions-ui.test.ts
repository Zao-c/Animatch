import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pool mobile action access", () => {
  const source = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");

  it("does not keep the pool navigation sticky on narrow screens", () => {
    expect(source).toContain("sm:sticky sm:top-24");
    expect(source).not.toContain("className=\"sticky top-20");
  });

  it("keeps anime wall management actions visible on touch screens", () => {
    expect(source).toContain("opacity-100 shadow-anime-panel");
    expect(source).toContain("sm:opacity-0 sm:group-hover:opacity-100");
  });
});
