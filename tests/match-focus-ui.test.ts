import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("match focus UI", () => {
  const matchSource = readFileSync("src/app/pools/[poolId]/runs/[runId]/match/page.tsx", "utf8");
  const duelSource = readFileSync("src/components/DuelAnimeCard.tsx", "utf8");

  it("keeps the primary pair ahead of the detailed progress card", () => {
    const pairGrid = matchSource.indexOf('grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]');
    const detailedProgress = matchSource.lastIndexOf("<RankingProgressCard");

    expect(pairGrid).toBeGreaterThan(-1);
    expect(detailedProgress).toBeGreaterThan(pairGrid);
    expect(matchSource).toContain("hidden text-sm leading-6 text-slate-500 sm:block");
    expect(matchSource).toContain("queueMeta.progress.effectiveComparisons");
  });

  it("reserves feedback space instead of inserting a queue refill banner above the cards", () => {
    expect(matchSource).toContain('className="min-h-[34px]" aria-live="polite" aria-atomic="true"');
    expect(matchSource).not.toContain('isRefilling ? <ErrorAlert');
    expect(matchSource).toContain('isRefilling ? " · 正在准备下一组" : ""');
  });

  it("keeps keyboard hints in the visible decision controls instead of duplicating a help panel", () => {
    expect(matchSource).not.toContain("showShortcutHelp");
    expect(matchSource).not.toContain("MatchShortcutHint");
    expect(matchSource).not.toContain('shortcut="←"');
    expect(matchSource).not.toContain('shortcut="→"');
  });

  it("does not expose the card container as a second nested button", () => {
    expect(duelSource).not.toContain('role="button"');
    expect(duelSource).not.toContain("tabIndex={disabled ? -1 : 0}");
    expect(duelSource).not.toContain("onKeyDown={(event) => {");
    expect(duelSource).toContain('<AppButton');
    expect(duelSource).toContain("onClick={(event) => {");
  });
});
