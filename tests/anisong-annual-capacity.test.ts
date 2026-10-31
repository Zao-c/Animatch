import { describe, expect, it } from "vitest";
import { emptySongDocument, MAX_TRACKS, type SongTrack } from "@/lib/anisong/types";
import { nextSongPair, rankSongs, songPairingCandidates, songSnapshot } from "@/lib/anisong/engine";
import { applySongTierLayout } from "@/lib/anisong/tier-layout";
import { songPngPages } from "@/lib/anisong/export";
const track = (i: number): SongTrack => ({ id: `annual-${i}`, title: `Song ${i}`, artist: "Artist", anime: "", kind: i % 2 ? "ED" : "OP", year: 2026, quarter: 1, tags: [], clipStart: 0, clipLength: 30, source: { kind: "none" } });
const fixture = () => ({ ...emptySongDocument(), tracks: Array.from({ length: MAX_TRACKS }, (_, i) => track(i)) });
describe("annual song playlists", () => {
  it("keeps all 1000 candidates and saves a tier containing more than 64 songs", () => {
    const doc = fixture();
    expect(MAX_TRACKS).toBe(1000);
    expect(rankSongs(doc).active).toHaveLength(1000);
    applySongTierLayout(doc, { s: doc.tracks.map(t => t.id), a: [], b: [], c: [], d: [], pending: [] });
    expect(songSnapshot("Annual", doc).rows.find(row => row.id === "s")?.songs).toHaveLength(1000);
    expect(doc.events).toEqual([]);
  });
  it("bounds pairing work, includes cold songs, preserves small-list behavior", () => {
    const scores = rankSongs(fixture()).active;
    scores.forEach(score => { score.compareCount = 10; });
    scores[900].compareCount = 0;
    const candidates = songPairingCandidates(scores, () => 0.5);
    expect(candidates.length).toBeLessThanOrEqual(128);
    expect(candidates).toContain(scores[900]);
    expect(new Set(candidates.map(s => s.animeId)).size).toBe(candidates.length);
    expect(songPairingCandidates(scores.slice(0,64), () => 0.5)).toEqual(scores.slice(0,64));
  });
  it("replays consistently, respects scope, and exposes more than 64 unique songs", () => {
    const doc = fixture();
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const pair = nextSongPair(doc)!;
      expect(pair).toEqual(nextSongPair(doc));
      expect(pair.left.id).not.toBe(pair.right.id);
      seen.add(pair.left.id); seen.add(pair.right.id);
      doc.events.push({ id: `vote-${i}`, leftId: pair.left.id, rightId: pair.right.id, result: "DRAW" });
    }
    expect(seen.size).toBeGreaterThan(64);
    expect(rankSongs(doc).progress.effectiveComparisons).toBe(50);
    doc.candidateIds = doc.tracks.slice(500,700).map(t => t.id);
    const pair = nextSongPair(doc)!;
    expect(doc.candidateIds).toContain(pair.left.id);
    expect(doc.candidateIds).toContain(pair.right.id);
  });
  it("exports large single-tier and pending lists without dropping or duplicating tracks", () => {
    const doc = fixture();
    for (const tier of ["pending", "s"]) {
      if (tier === "s") doc.manualTiers = Object.fromEntries(doc.tracks.map(t => [t.id,"s"]));
      const snapshot = songSnapshot("Annual", doc);
      const pages = songPngPages(snapshot);
      expect(pages).toHaveLength(7);
      expect(pages.flatMap(p => p.rows.flatMap(r => r.songs.map(s => s.id)))).toEqual(snapshot.rows.flatMap(r => r.songs.map(s => s.id)));
      for (const page of pages) expect(page.rows.flatMap(r => r.songs).length).toBeLessThanOrEqual(150);
    }
  });
});
