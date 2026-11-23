import { describe, expect, it } from "vitest";
import { songBoardSummary } from "@/lib/anisong/summary";
import { emptySongDocument, type SongTrack } from "@/lib/anisong/types";
const track = (id: string, coverUrl?: string): SongTrack => ({
  id, title: id, artist: "", anime: "", kind: "OP", year: null, quarter: null, tags: [],
  clipStart: 0, clipLength: 30, source: { kind: "none" }, coverUrl
});
describe("music lobby summaries", () => {
  it("never includes full comparison ledgers or private audio source identifiers", () => {
    const doc = { ...emptySongDocument(), tracks: [track("one", "https://test/a.png"), track("two", "https://test/a.png"), track("three", "https://test/b.png")],
      events: [{ id: "secret-vote", leftId: "one", rightId: "two", result: "LEFT_WIN" as const }] };
    doc.tracks[0].source = { kind: "upload", key: "private/song.mp3", bytes: 128, mime: "audio/mpeg" };
    const result = songBoardSummary({ id: "b", title: "年度", templateId: null, updatedAt: new Date("2026-11-04T00:00:00.000Z"), document: doc });
    expect(result).toMatchObject({ id: "b", trackCount: 3, playableCount: 1, progress: 1, canStart: true, covers: ["https://test/a.png", "https://test/b.png"] });
    expect(JSON.stringify(result)).not.toContain("private/song.mp3");
    expect(JSON.stringify(result)).not.toContain("secret-vote");
  });
  it("does not allow match for an empty or single-track playlist", () => {
    const doc = { ...emptySongDocument(), tracks: [track("only")] };
    const result = songBoardSummary({ id: "b", title: "New", templateId: "public-template", updatedAt: new Date(), document: doc });
    expect(result.canStart).toBe(false);
    expect(result.templateId).toBe("public-template");
  });
});
