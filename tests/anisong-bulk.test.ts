import { describe, expect, it } from "vitest";
import { changeSongCandidates, selectedSongIds, songBulkPatch } from "@/lib/anisong/bulk";
import { emptySongDocument, type SongTrack } from "@/lib/anisong/types";
const tracks: SongTrack[] = ["a", "b", "c", "d"].map(id => ({ id, title: id, artist: "", anime: "", year: null, quarter: null, kind: "OP", tags: [], source: { kind: "none" }, clipStart: 0, clipLength: 30 }));
const doc = () => ({ ...emptySongDocument(), tracks });
describe("bulk song editing", () => {
  it("validates and deduplicates only songs from the current board", () => {
    expect(selectedSongIds(["a", "a", "b"], tracks)).toEqual(["a", "b"]);
    for (const input of [[], ["other"], [null], "a", Array(65).fill("a")]) expect(() => selectedSongIds(input, tracks)).toThrow();
  });
  it("only includes explicitly chosen fields", () => {
    expect(songBulkPatch({ anime: " 秋日来信 ", year: "2026" })).toEqual({ anime: "秋日来信", year: 2026 });
    expect(songBulkPatch({ kind: "ED" })).toEqual({ kind: "ED" });
  });
  it("allows explicit clearing of optional fields", () => {
    expect(songBulkPatch({ anime: "", year: "", quarter: "", tags: "" })).toEqual({ anime: "", year: null, quarter: null, tags: [] });
  });
  it("uses single-song validation for tags and numeric fields", () => {
    expect(songBulkPatch({ tags: "摇滚，治愈,摇滚" })).toEqual({ tags: ["摇滚", "治愈"] });
    for (const patch of [{ year: 2026.5 }, { quarter: 5 }, { kind: null }, { kind: "invalid" }, { tags: Array(9).fill("x").join(",") }, { anime: "x".repeat(121) }]) expect(() => songBulkPatch(patch)).toThrow();
  });
  it("rejects empty patches and attempts to overwrite sources, IDs or comparison history", () => {
    for (const patch of [{}, { title: "overwrite" }, { source: { kind: "none" } }, { id: "other" }, { events: [] }, { coverUrl: null }]) expect(() => songBulkPatch(patch)).toThrow();
  });
  it("excludes selected tracks from the full candidate pool", () => {
    const source = doc();
    expect(changeSongCandidates(source, ["a"], "exclude")).toEqual(["b", "c", "d"]);
    expect(source.candidateIds).toBeNull();
  });
  it("adds to a custom pool and preserves automatic inclusion for a full pool", () => {
    expect(changeSongCandidates({ ...doc(), candidateIds: ["b", "c"] }, ["a"], "include")).toEqual(["a", "b", "c"]);
    expect(changeSongCandidates(doc(), ["a"], "include")).toBeNull();
  });
  it("rejects invalid modes and a candidate pool smaller than two", () => {
    expect(() => changeSongCandidates(doc(), ["a"], "remove")).toThrow();
    expect(() => changeSongCandidates(doc(), ["a", "b", "c"], "exclude")).toThrow();
    expect(changeSongCandidates(doc(), ["a", "b"], "exclude")).toEqual(["c", "d"]);
  });
});
