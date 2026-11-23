import { describe, expect, it } from "vitest";
import { MAX_TAGS, mergeTags } from "../src/components/QuickImportPanel";
import { validateQuickImportParams } from "../src/lib/import/quick-import-options";

/**
 * The quick-import form previously let the user pick an unbounded number of
 * tags, but the shared server validator (`validateQuickImportParams`) rejects
 * anything beyond 5. The request then failed with a confusing 400. These tests
 * pin the client-side cap so the built request is always accepted.
 */
describe("quick import tag limit", () => {
  it("caps selected common tags at the shared server limit", () => {
    const merged = mergeTags(["romance", "school", "isekai", "action", "comedy", "horror"], "");

    expect(merged).toHaveLength(MAX_TAGS);
    expect(merged).toEqual(["romance", "school", "isekai", "action", "comedy"]);
  });

  it("counts custom tags toward the limit", () => {
    const merged = mergeTags(["romance"], "校园, 科幻, 战斗, 治愈, 日常, 多余的");

    expect(merged).toHaveLength(MAX_TAGS);
    expect(merged).toEqual(["romance", "校园", "科幻", "战斗", "治愈"]);
  });

  it("dedupes case-insensitively before applying the cap", () => {
    const merged = mergeTags(["Romance", "School"], "romance, 科幻, 战斗, 治愈, 日常");

    expect(merged.filter((tag) => tag.toLowerCase() === "romance")).toHaveLength(1);
    expect(merged).toHaveLength(MAX_TAGS);
  });

  it("produces params that pass server validation even when many tags are entered", () => {
    const params = {
      source: "BANGUMI" as const,
      mode: "TAG" as const,
      year: 2026,
      tags: mergeTags(["a", "b", "c", "d", "e", "f", "g", "h", "i"], "j, k, l"),
    };

    expect(params.tags).toHaveLength(MAX_TAGS);
    expect(() => validateQuickImportParams(params)).not.toThrow();
  });

  it("still rejects an over-limit payload sent directly to the server", () => {
    expect(() =>
      validateQuickImportParams({
        source: "BANGUMI",
        mode: "TAG",
        year: 2026,
        tags: ["a", "b", "c", "d", "e", "f"],
      })
    ).toThrow("5");
  });
});
