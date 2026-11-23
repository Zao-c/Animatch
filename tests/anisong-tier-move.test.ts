import { describe, expect, it } from "vitest";
import { moveSongInTierLayout } from "@/components/anisong/SongTierEditor";

const fixture = () => ({ s: ["one", "two"], a: ["three"], b: [], c: [], d: [], pending: ["four"], hidden: ["hidden"], excluded: ["excluded"] });
describe("music tier draft moves", () => {
  it("moves across tiers without mutating the saved layout or duplicating a song", () => {
    const rows = fixture();
    const next = moveSongInTierLayout(rows, "one", "a", "three");
    expect(rows).toEqual(fixture());
    expect(next.s).toEqual(["two"]);
    expect(next.a).toEqual(["one", "three"]);
    expect(Object.values(next).flat().filter(id => id === "one")).toHaveLength(1);
  });
  it("reorders within a tier in both directions", () => {
    const next = moveSongInTierLayout(fixture(), "two", "s", "one");
    expect(next.s).toEqual(["two", "one"]);
    expect(moveSongInTierLayout(next, "two", "s").s).toEqual(["one", "two"]);
  });
  it("allows a pending candidate to be manually ranked", () => {
    const next = moveSongInTierLayout(fixture(), "four", "b");
    expect(next.pending).toEqual([]);
    expect(next.b).toEqual(["four"]);
  });
  it("leaves hidden and excluded songs outside the editable ranks", () => {
    const rows = fixture();
    expect(moveSongInTierLayout(rows, "hidden", "s")).toBe(rows);
    expect(moveSongInTierLayout(rows, "excluded", "s")).toBe(rows);
    expect(moveSongInTierLayout(rows, "one", "hidden")).toBe(rows);
    expect(moveSongInTierLayout(rows, "missing", "s")).toBe(rows);
  });
});
