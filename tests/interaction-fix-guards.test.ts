import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Static regression guards for interaction fixes that have no DOM runtime in
 * this test environment (Vitest runs with `environment: "node"`, and the repo
 * has no jsdom/testing-library/Playwright). Each guard pins the exact code shape
 * that fixes a confirmed silent-failure / stale-state / fake-success bug. They
 * are source-level checks, not behavioural render tests — behavioural coverage
 * for the same batch lives in quick-import-tag-limit.test.ts and
 * share-tier-page-error.test.ts.
 */

const read = (path: string) => readFileSync(path, "utf8");

describe("admin pool edit: clearing the description reaches the server", () => {
  const source = read("src/app/admin/page.tsx");

  it("sends the description verbatim instead of dropping an empty string", () => {
    expect(source).toContain("description: editDescription,");
    expect(source).not.toContain("description: editDescription || undefined");
  });

  it("surfaces dangerous-action failures inside the still-open confirm dialog", () => {
    const dialogStart = source.indexOf("confirmTarget ? (");
    const dialog = source.slice(dialogStart, source.indexOf("</PageShell>", dialogStart));

    expect(dialogStart).toBeGreaterThan(-1);
    expect(dialog).toContain("poolError");
  });
});

describe("user profile: pagination resets when the username changes", () => {
  const source = read("src/app/u/[username]/page.tsx");

  it("resets contentPage inside the username effect", () => {
    const effectStart = source.indexOf("useEffect(() => {");
    const effect = source.slice(effectStart, source.indexOf("}, [username]);", effectStart));

    expect(effectStart).toBeGreaterThan(-1);
    expect(effect).toContain("setContentPage(1)");
  });
});

describe("cover repair card: can rescan after applying fixes", () => {
  const source = read("src/components/CoverRepairCard.tsx");

  it("does not gate the scan button on applyResult being empty", () => {
    expect(source).not.toContain("scanResult === null && applyResult === null ? (");
  });

  it("offers a follow-up scan once an apply completes", () => {
    expect(source).toContain('applyResult !== null ? "再次扫描" : "修复导入封面"');
  });
});

describe("playtest feedback: stale copy success is cleared on edit", () => {
  const source = read("src/components/PlaytestFeedbackButton.tsx");

  it("resets a copied status when the feedback content changes", () => {
    expect(source).toContain('setCopyStatus((prev) => (prev === "copied" ? "idle" : prev));');
  });
});

describe("tier config save: no silent no-op before the pool loads", () => {
  const source = read("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx");

  it("reports an error instead of silently returning", () => {
    expect(source).not.toContain("if (poolUpdatedAt === null) return;");
    expect(source).toContain("番组信息尚未加载完成");
  });
});
