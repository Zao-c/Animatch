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
    expect(source).toContain("from-slate-950/18");
    expect(source).toContain("bg-slate-950/24");
    expect(source).toContain("line-clamp-2");
  });

  it("lets users roll to another pair without submitting a vote", () => {
    expect(source).toContain("function handleRollPair()");
    expect(source).toContain("setCurrentIndex((current) => current + 1)");
    expect(source).toContain("换一组");
  });

  it("tracks skipped pair ids locally to avoid repeating same pairs", () => {
    expect(source).toContain("skippedPairKeys");
    expect(source).toContain("skippedPairKeys.has(item.pairId)");
    expect(source).toContain('next.add(currentPair.pairId)');
    expect(source).toContain("filtered.length > 0 ? filtered : q");
  });

  it("handleRollPair does not call submitSeasonVote", () => {
    const preHandleRoll = source.indexOf("function handleRollPair()");
    const rollBody = source.slice(preHandleRoll, preHandleRoll + 500);
    expect(rollBody).not.toContain("submitSeasonVote");
    expect(rollBody).toContain("setCurrentIndex");
  });

  it("shows hint when no more new pairs after rolling", () => {
    expect(source).toContain("暂时没有更多可换组合");
    expect(source).toContain("可以先投当前组或稍后再试");
  });
});
