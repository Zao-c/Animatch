import { describe, expect, it } from "vitest";
import { selectedPublicSongIds } from "@/lib/anisong/shared/templates";

describe("personal public-song participation range", () => {
  const ids = ["a", "b", "c", "d"];
  it("treats full selection as the full public pool, not a frozen partial list", () => {
    expect(selectedPublicSongIds(null, ids)).toBeNull();
    expect(selectedPublicSongIds([...ids], ids)).toBeNull();
    expect(selectedPublicSongIds(["a", "c"], ids)).toEqual(["a", "c"]);
  });
  it("rejects duplicates with only one unique song, invalid names, and stale selections", () => {
    expect(() => selectedPublicSongIds(["a", "a"], ids)).toThrow();
    expect(() => selectedPublicSongIds(["a", "unknown"], ids)).toThrow();
    expect(() => selectedPublicSongIds([], ids)).toThrow();
  });
});
