import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIER_LABELS,
  getTierLabelStorageKey,
  normalizeTierLabelInput,
  readTierLabels,
  resetTierLabels,
  saveTierLabels
} from "../src/lib/tier-labels";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

describe("tier label helpers", () => {
  it("returns default labels without storage", () => {
    expect(readTierLabels("pool-1", "run-1", null)).toEqual(DEFAULT_TIER_LABELS);
  });

  it("builds a storage key with pool and run ids", () => {
    expect(getTierLabelStorageKey("pool-1", "run-1")).toBe(
      "animatch:tier-labels:pool-1:run-1"
    );
  });

  it("normalizes whitespace and trims long labels", () => {
    expect(normalizeTierLabelInput("  神作   候选  ")).toBe("神作 候选");
    expect(normalizeTierLabelInput("abcdefghijklmnopq")).toBe("abcdefghijklmnop");
    expect(normalizeTierLabelInput("一二三四五六七八九")).toBe("一二三四五六七八");
  });

  it("saves labels and falls back to defaults for empty values", () => {
    const storage = createMemoryStorage();
    const saved = saveTierLabels(
      "pool-1",
      "run-1",
      { S: "神作", A: "", B: "B", C: "C", D: "D" },
      storage
    );

    expect(saved.S).toBe("神作");
    expect(saved.A).toBe("A");
    expect(readTierLabels("pool-1", "run-1", storage)).toEqual(saved);
  });

  it("resets labels to defaults", () => {
    const storage = createMemoryStorage();
    saveTierLabels("pool-1", "run-1", { S: "神作" }, storage);

    expect(resetTierLabels("pool-1", "run-1", storage)).toEqual(DEFAULT_TIER_LABELS);
    expect(readTierLabels("pool-1", "run-1", storage)).toEqual(DEFAULT_TIER_LABELS);
  });
});
