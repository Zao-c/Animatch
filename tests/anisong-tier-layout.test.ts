import { describe, expect, it } from "vitest";
import { applySongTierLayout, resetSongTierLayout, SONG_EDITABLE_TIERS } from "@/lib/anisong/tier-layout";
import { rankSongs, songSnapshot } from "@/lib/anisong/engine";
import { emptySongDocument, type SongDocument, type SongTrack } from "@/lib/anisong/types";

const track = (id: string): SongTrack => ({
  id, title: id, artist: "", anime: "", kind: "OP", year: null, quarter: null, tags: [],
  clipStart: 0, clipLength: 30, source: { kind: "none" }
});
const fixture = (): SongDocument => {
  const doc = emptySongDocument();
  doc.tracks = ["a", "b", "c", "d"].map(track);
  doc.events.push({ id: "one", leftId: "a", rightId: "b", result: "LEFT_WIN" });
  return doc;
};
function layout(doc: SongDocument): Record<string, string[]> {
  const rank = rankSongs(doc);
  return Object.fromEntries([
    ...SONG_EDITABLE_TIERS.map(tier => [tier, rank.tiers[tier].map(song => song.animeId)] as const),
    ["pending", rank.pending.map(song => song.animeId)]
  ]);
}
function take(from: Record<string, string[]>, id: string, to: string, before?: string) {
  for (const songs of Object.values(from)) {
    const index = songs.indexOf(id);
    if (index >= 0) songs.splice(index, 1);
  }
  const index = before ? from[to].indexOf(before) : -1;
  from[to].splice(index < 0 ? from[to].length : index, 0, id);
}

describe("Anisong tier layout", () => {
  it("preserves the exact cross-tier and within-tier order while leaving Elo and votes alone", () => {
    const doc = fixture();
    const before = rankSongs(doc).scores.map(score => [score.animeId, score.eloScore]);
    const events = structuredClone(doc.events);
    const rows = layout(doc);
    take(rows, "b", "s", "a");
    take(rows, "c", "a");
    applySongTierLayout(doc, rows);
    expect(songSnapshot("my list", doc).rows.find(row => row.id === "s")?.songs.map(song => song.id)).toEqual(["b", "a"]);
    expect(songSnapshot("my list", doc).rows.find(row => row.id === "a")?.songs.map(song => song.id)).toEqual(["c"]);
    expect(rankSongs(doc).pending.map(song => song.animeId)).toEqual(["d"]);
    expect(rankSongs(doc).scores.map(score => [score.animeId, score.eloScore])).toEqual(before);
    expect(doc.events).toEqual(events);
    expect(doc.manualTiers).toMatchObject({ a: "s", b: "s", c: "a" });
    expect(doc.manualOrder?.s).toEqual(["b", "a"]);
  });
  it("preserves excluded-song preferences and supports restoring automatic tiers", () => {
    const doc = fixture();
    doc.candidateIds = ["a", "b", "c"];
    doc.manualTiers.d = "s";
    doc.manualOrder = { s: ["d"] };
    const rows = layout(doc);
    take(rows, "c", "s");
    applySongTierLayout(doc, rows);
    expect(doc.manualTiers.d).toBe("s");
    expect(doc.manualOrder?.s).toContain("d");
    resetSongTierLayout(doc);
    expect(doc.manualTiers).toEqual({ d: "s" });
    expect(doc.manualOrder?.s).toEqual(["d"]);
    expect(rankSongs(doc).pending.map(s => s.animeId)).toContain("c");
    expect(doc.events).toHaveLength(1);
  });
  it("validates missing, repeated, hidden and stale candidates before mutation", () => {
    const doc = fixture();
    const rows = layout(doc);
    const serialized = JSON.stringify(doc);
    for (const invalid of [
      { ...rows, s: [...rows.s, "a"] },
      { ...rows, s: [...rows.s, "unknown"] },
      { ...rows, pending: [] },
      { ...rows, hidden: [] },
      { ...rows, pending: [...rows.pending, "a"] }
    ]) {
      expect(() => applySongTierLayout(doc, invalid)).toThrow();
      expect(JSON.stringify(doc)).toBe(serialized);
    }
    doc.events.push({ id: "unheard", leftId: "c", rightId: "d", result: "LEFT_UNSEEN" });
    expect(() => applySongTierLayout(doc, rows)).toThrow();
  });
  it("accepts legacy v1 documents without manualOrder", () => {
    const doc = fixture();
    expect(doc.manualOrder).toBeUndefined();
    expect(songSnapshot("legacy", doc).rows.find(row => row.id === "pending")?.songs).toHaveLength(2);
    applySongTierLayout(doc, layout(doc));
    expect(doc.manualOrder?.s).toBeDefined();
    resetSongTierLayout(doc);
    expect(doc.manualOrder).toBeUndefined();
  });
});
