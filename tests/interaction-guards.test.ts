import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural regression guards for the navigation/interaction fixes.
 *
 * These assert the *shape* of the fixed markup/handlers where a full DOM
 * interaction test is not available in the project's Vitest (node) setup.
 * Real behavioural tests for the batch API, search helpers, clipboard fallback
 * and season CTA live in batch-anime-api.test.ts, pool-anime-search.test.ts,
 * browser-copy.test.ts and season-schedule.test.ts.
 */

const poolDetailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
const poolsSource = readFileSync("src/app/pools/page.tsx", "utf8");
const authNavSource = readFileSync("src/components/AuthNav.tsx", "utf8");
const seasonsSource = readFileSync("src/components/PoolSeasonsSection.tsx", "utf8");
const seasonDetailSource = readFileSync("src/app/pools/[poolId]/seasons/[seasonId]/page.tsx", "utf8");

function sliceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("batch selection card (BUG 5)", () => {
  const cardSource = sliceBetween(poolDetailSource, "function PoolAnimeCard(", "function BangumiResultCard(");

  it("exposes a single toggle control for the whole card", () => {
    expect(cardSource).toContain('role={batchMode ? "button" : undefined}');
    expect(cardSource).toContain('aria-pressed={batchMode ? isBatchSelected : undefined}');
    expect(cardSource).toContain('tabIndex={batchMode ? 0 : undefined}');
  });

  it("no longer nests a second toggle (checkbox) inside the card", () => {
    // The previous implementation had both the card onClick/onKeyDown AND an
    // inner checkbox onChange calling the same toggle, which double-fired.
    expect(cardSource).not.toContain('type="checkbox"');
    expect(cardSource).not.toMatch(/onChange=\{\(\) => onToggleBatchSelect/);
    expect(cardSource).not.toMatch(/onChange=\{onToggleBatchSelect\}/);
  });

  it("renders the selection indicator as a non-interactive visual", () => {
    expect(cardSource).toContain('aria-hidden="true"');
    expect(cardSource).toContain("pointer-events-none");
  });
});

describe("auth nav (BUG 3)", () => {
  it("re-syncs the auth state on navigation instead of only on mount", () => {
    expect(authNavSource).toMatch(/\}, \[pathname\]\);/);
    expect(authNavSource).not.toMatch(/\}, \[\]\);/);
  });

  it("preserves the full current URL (query + hash) as the login target", () => {
    expect(authNavSource).toContain("sanitizeNextPath");
    expect(authNavSource).toContain("window.location.search");
    expect(authNavSource).toContain("window.location.hash");
  });
});

describe("copy pool id (BUG 4)", () => {
  it("uses the copy helper and never reports a fake success", () => {
    expect(poolsSource).toContain("copyTextWithFallback");
    expect(poolsSource).not.toContain("navigator.clipboard?.writeText");
    expect(poolsSource).toContain('result === "copied"');
  });
});

describe("season list CTA (BUG 6)", () => {
  it("uses a label that matches its destination", () => {
    expect(seasonsSource).toContain("state.ctaLabel");
    expect(seasonsSource).not.toContain("进入对决");
  });

  it("routes logged-out visitors through login before the duel", () => {
    expect(seasonDetailSource).toContain("getSeasonMatchEntry");
    expect(seasonDetailSource).toContain("detail.currentUserState !== null");
  });
});
