import { describe, expect, it, vi } from "vitest";
import { emptySongDocument, type SongDocument, type SongTrack } from "@/lib/anisong/types";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { publicSongDocument } from "@/lib/anisong/publication";

const song = (id: string, source: SongTrack["source"]): SongTrack => ({
  id, title: id, artist: "歌手", anime: "所属动画", kind: "OP", year: null, quarter: null,
  tags: [], clipStart: 0, clipLength: 30, source, importKey: "private-import-key"
});

describe("public music playlist metadata boundary", () => {
  it("defaults to public metadata without leaking private audio paths or personal rankings", () => {
    const doc: SongDocument = {
      ...emptySongDocument(),
      tracks: [
        song("upload", { kind: "upload", key: "private/audio.wav", mime: "audio/wav", bytes: 100 }),
        song("url", { kind: "url", url: "https://private.example/audio" }),
        song("netease", { kind: "netease", id: "private-account-song" }),
        song("itunes", { kind: "itunes", id: "public-1", country: "JP" })
      ],
      events: [{ id: "secret-vote", leftId: "upload", rightId: "url", result: "LEFT_WIN" }],
      manualTiers: { upload: "S" }
    };
    const published = publicSongDocument(doc);
    expect(published.tracks.map(track => track.source.kind)).toEqual(["none", "none", "none", "itunes"]);
    expect(published.tracks.every(track => !("importKey" in track))).toBe(true);
    expect(published.events).toEqual([]);
    expect(published.manualTiers).toEqual({});
    expect(JSON.stringify(published)).not.toContain("private/audio.wav");
    expect(JSON.stringify(published)).not.toContain("private.example");
    expect(JSON.stringify(published)).not.toContain("secret-vote");
  });
  it("preserves public pool audio only when the board still references an already approved asset", () => {
    const live: SongDocument = { ...emptySongDocument(), tracks: [song("a", { kind: "pool", assetId: "shared" }), song("b", { kind: "pool", assetId: "never-approved" })] };
    const older: SongDocument = { ...emptySongDocument(), tracks: [song("a", { kind: "pool", assetId: "shared" })] };
    expect(publicSongDocument(live, older).tracks.map(track => track.source.kind)).toEqual(["pool", "none"]);
  });
});
