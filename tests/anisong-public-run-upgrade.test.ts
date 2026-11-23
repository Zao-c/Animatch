import { describe, expect, it } from "vitest";
import { extendPublicSongRun } from "@/lib/anisong/shared/templates";
import { emptySongDocument, type SongDocument, type SongTrack } from "@/lib/anisong/types";

const song = (id: string): SongTrack => ({
  id, title: "Track " + id, artist: "Artist", anime: "Anime", kind: "OP",
  year: 2026, quarter: 4, tags: [], clipStart: 0, clipLength: 30,
  source: { kind: "none" }
});

describe("old personal progress with updated public song playlists", () => {
  it("appends explicitly selected new public tracks but preserves old vote and tier history", () => {
    const old: SongDocument = { ...emptySongDocument(), tracks: [song("a"), song("b"), song("removed")],
      events: [{ id: "v1", leftId: "a", rightId: "b", result: "LEFT_WIN" }],
      manualTiers: { a: "S" }, candidateIds: ["a", "b"] };
    const current: SongDocument = { ...emptySongDocument(), tracks: [song("a"), song("b"), song("new")] };
    const next = extendPublicSongRun(old, current, ["a", "new"]);
    expect(next.tracks.map(t => t.id)).toEqual(["a", "b", "removed", "new"]);
    expect(next.events).toEqual(old.events);
    expect(next.manualTiers).toEqual(old.manualTiers);
    expect(next.candidateIds).toEqual(["a", "b"]);
  });
  it("only appends selected public tracks and does not mutate the original run", () => {
    const old = { ...emptySongDocument(), tracks: [song("a"), song("b")] };
    const current = { ...emptySongDocument(), tracks: [song("a"), song("b"), song("c"), song("d")] };
    const selected = extendPublicSongRun(old, current, ["a", "c"]);
    expect(selected.tracks.map(t => t.id)).toEqual(["a", "b", "c"]);
    expect(old.tracks).toHaveLength(2);
    const unchanged = extendPublicSongRun(old, current, ["a", "b"]);
    expect(unchanged).toBe(old);
  });
  it("strips any legacy import keys from newly adopted public metadata", () => {
    const old = { ...emptySongDocument(), tracks: [song("a"), song("b")] };
    const current = { ...emptySongDocument(), tracks: [{ ...song("new"), importKey: "never-copy" }] };
    const result = extendPublicSongRun(old, current, null);
    expect(result.tracks[2]).not.toHaveProperty("importKey");
  });
});
