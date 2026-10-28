import { describe, expect, it } from "vitest";
import { rankSongs, nextSongPair, songSnapshot } from "@/lib/anisong/engine";
import { emptySongDocument, type SongDocument, type SongTrack } from "@/lib/anisong/types";
const track = (id: string): SongTrack => ({ id, title: id, artist: "artist", anime: "anime", kind: "OP", year: 2026, quarter: 4, tags: [], clipStart: 0, clipLength: 30, source: { kind: "url", url: "https://example.com/private.mp3" } });
const fixture = (): SongDocument => ({ ...emptySongDocument(), tracks: [track("a"), track("b"), track("c")] });
describe("AnisongMatch ledger", () => {
  it("keeps uncompared songs pending, then ranks the winner above the loser", () => {
    const doc = fixture();
    expect(rankSongs(doc).pending).toHaveLength(3);
    expect(Object.values(rankSongs(doc).tiers).flat()).toHaveLength(0);
    doc.events.push({ id: "1", leftId: "a", rightId: "b", result: "LEFT_WIN" });
    const ranking = rankSongs(doc);
    expect(ranking.scores[0].animeId).toBe("a");
    expect(ranking.scores.at(-1)?.animeId).toBe("b");
    expect(ranking.pending.map(s => s.animeId)).toEqual(["c"]);
  });
  it("replays undo exactly, ignores skips, and handles draws symmetrically", () => {
    const doc = fixture();
    const before = rankSongs(doc).scores;
    doc.events.push({ id: "1", leftId: "a", rightId: "b", result: "LEFT_WIN" });
    doc.events.pop();
    expect(rankSongs(doc).scores).toEqual(before);
    doc.events.push({ id: "2", leftId: "a", rightId: "b", result: "SKIP" });
    expect(rankSongs(doc).scores).toEqual(before);
    doc.events.push({ id: "3", leftId: "a", rightId: "b", result: "DRAW" });
    expect(rankSongs(doc).progress.effectiveComparisons).toBe(1);
    expect(rankSongs(doc).scores.every(s => s.eloScore === 1500)).toBe(true);
    const nonempty = Object.values(rankSongs(doc).tiers).filter(t => t.length);
    expect(nonempty).toHaveLength(1);
    expect(nonempty[0]).toHaveLength(2);
  });
  it("excludes unheard songs from pairing and restores on undo", () => {
    const doc = fixture();
    doc.events.push({ id: "1", leftId: "a", rightId: "b", result: "LEFT_UNSEEN" });
    expect(rankSongs(doc).hidden[0].animeId).toBe("a");
    const pair = nextSongPair(doc, () => 0);
    expect([pair?.left.id, pair?.right.id].sort()).toEqual(["b", "c"]);
    doc.events.pop(); expect(rankSongs(doc).active).toHaveLength(3);
  });
  it("uses only selected-to-selected evidence and keeps prior results when restoring the scope", () => {
    const doc = fixture();
    doc.events.push({ id: "1", leftId: "a", rightId: "c", result: "LEFT_WIN" });
    const before = rankSongs(doc).scores;
    doc.candidateIds = ["a", "b"];
    expect(rankSongs(doc).progress.effectiveComparisons).toBe(0);
    expect(rankSongs(doc).pending).toHaveLength(2);
    expect(rankSongs(doc).scores.every(s => s.eloScore === 1500)).toBe(true);
    expect([nextSongPair(doc, () => 0)?.left.id, nextSongPair(doc, () => 0)?.right.id].sort()).toEqual(["a", "b"]);
    doc.candidateIds = null;
    expect(rankSongs(doc).scores).toEqual(before);
  });
  it("manual placement does not change ratings or history and snapshots contain no audio", () => {
    const doc = fixture();
    doc.manualTiers.a = "s";
    expect(rankSongs(doc).tiers.s[0].animeId).toBe("a");
    expect(rankSongs(doc).scores[0].eloScore).toBe(1500);
    expect(doc.events).toEqual([]);
    const snapshot = songSnapshot("test", doc);
    expect(JSON.stringify(snapshot)).not.toContain("private.mp3");
    expect(JSON.stringify(snapshot)).not.toContain("source");
    delete doc.manualTiers.a;
    expect(rankSongs(doc).pending).toHaveLength(3);
  });
  it("prioritizes exposing every song in a larger library", () => {
    const doc = fixture(); doc.tracks = Array.from({ length: 16 }, (_, i) => track(`song-${i}`));
    for (let i = 0; i < 32; i++) {
      const pair = nextSongPair(doc, () => 0.3)!;
      doc.events.push({ id: String(i), leftId: pair.left.id, rightId: pair.right.id, result: i % 2 ? "RIGHT_WIN" : "LEFT_WIN" });
    }
    expect(rankSongs(doc).pending).toHaveLength(0);
    expect(rankSongs(doc).active.every(s => s.compareCount > 0)).toBe(true);
  });
});
