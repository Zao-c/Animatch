import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("season match UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/seasons/[seasonId]/match/page.tsx", "utf8");

  it("uses AnimeCover fallback behavior instead of raw next image", () => {
    expect(source).toContain("<AnimeCover");
    expect(source).toContain("secondarySrc={secondarySrc}");
    expect(source).toContain("animeId={anime.animeId}");
    expect(source).not.toContain("import Image from \"next/image\"");
  });

  it("keeps the title overlay light so covers remain primary", () => {
    expect(source).toContain("from-slate-950/35");
    expect(source).toContain("bg-slate-950/38");
    expect(source).toContain("line-clamp-2");
  });
});
