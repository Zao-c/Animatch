import { beforeEach, describe, expect, it, vi } from "vitest";
import { addSongTrack, changeSongBoard, deleteSongBoard, ownedSongBoard } from "@/lib/anisong/service";
import { emptySongDocument, type SongDocument, type SongTrack } from "@/lib/anisong/types";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), discardAudio: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { songBoard: mocks } }));
vi.mock("@/lib/anisong/audio-storage", () => ({ discardAudio: mocks.discardAudio }));
const song = (id: string): SongTrack => ({ id, title: id, artist: "", anime: "", kind: "OP", year: null, quarter: null, tags: [], clipStart: 0, clipLength: 30, source: { kind: "none" } });
const document = (): SongDocument => ({ ...emptySongDocument(), tracks: [song("a"), song("b")] });
const board = (doc = document()) => ({ id: "board", ownerId: "owner", title: "test", revision: 3, document: doc, shareToken: null, snapshot: null, createdAt: new Date(), updatedAt: new Date() });
beforeEach(() => { vi.resetAllMocks(); mocks.findFirst.mockResolvedValue(board()); mocks.updateMany.mockResolvedValue({ count: 1 }); mocks.deleteMany.mockResolvedValue({ count: 1 }); });
describe("music board persistence", () => {
  it("atomically changes selected metadata and preserves media, history, tiers and share snapshots", async () => {
    const doc = document(); doc.tracks.push(song("c"));
    doc.tracks[0].source = { kind: "upload", key: "kept.wav", mime: "audio/wav", bytes: 100 };
    doc.tracks[0].coverUrl = "https://example.com/cover.jpg";
    doc.tracks[0].clipStart = 12; doc.tracks[0].importKey = "kept-import";
    doc.events.push({ id: "one", leftId: "a", rightId: "b", result: "DRAW" });
    doc.manualTiers.a = "s"; doc.candidateIds = ["a", "b"];
    mocks.findFirst.mockResolvedValue(board(doc));
    const result = await changeSongBoard("owner", "board", { revision: 3, action: "bulkEdit", trackIds: ["a", "b"], patch: { anime: "秋日来信", kind: "ED" } });
    expect(mocks.updateMany).toHaveBeenCalledOnce();
    expect(result.document.tracks[0]).toEqual({ ...doc.tracks[0], anime: "秋日来信", kind: "ED" });
    expect(result.document.tracks[1].kind).toBe("ED");
    expect(result.document.tracks[2]).toEqual(doc.tracks[2]);
    expect(result.document.events).toEqual(doc.events); expect(result.document.manualTiers).toEqual(doc.manualTiers); expect(result.document.candidateIds).toEqual(doc.candidateIds);
    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty("snapshot");
    expect(mocks.discardAudio).not.toHaveBeenCalled();
  });
  it("does not partially save a bulk edit with invalid targets or fields", async () => {
    for (const input of [{ trackIds: ["a", "missing"], patch: { kind: "ED" } }, { trackIds: ["a"], patch: { quarter: 8 } }, { trackIds: ["a"], patch: { source: { kind: "none" } } }]) {
      await expect(changeSongBoard("owner", "board", { revision: 3, action: "bulkEdit", ...input })).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("rejects bulk edits on stale or concurrently replaced revisions", async () => {
    const input = { action: "bulkEdit", trackIds: ["a", "b"], patch: { year: "2026" } };
    await expect(changeSongBoard("owner", "board", { revision: 2, ...input })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(changeSongBoard("owner", "board", { revision: 3, ...input })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("reports a revision conflict before validating targets removed in another tab", async () => {
    mocks.findFirst.mockResolvedValue(board(emptySongDocument()));
    for (const action of ["bulkEdit", "candidateSelection", "candidates"]) {
      await expect(changeSongBoard("owner", "board", { revision: 2, action, trackIds: ["a", "b"], patch: { kind: "ED" }, mode: "exclude" })).rejects.toMatchObject({ statusCode: 409 });
    }
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("changes candidate membership without deleting any comparison history", async () => {
    const doc = document(); doc.tracks.push(song("c"));
    doc.events.push({ id: "one", leftId: "a", rightId: "b", result: "LEFT_WIN" });
    mocks.findFirst.mockResolvedValue(board(doc));
    const result = await changeSongBoard("owner", "board", { revision: 3, action: "candidateSelection", trackIds: ["a"], mode: "exclude" });
    expect(result.document.candidateIds).toEqual(["b", "c"]);
    expect(result.document.events).toEqual(doc.events);
    expect(result.document.tracks).toEqual(doc.tracks);
  });
  it("scopes reads and writes to the authenticated owner and uses compare-and-swap", async () => {
    const result = await changeSongBoard("owner", "board", { revision: 3, action: "vote", eventId: "one", leftId: "a", rightId: "b", result: "LEFT_WIN", ownerId: "attacker" });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "board", ownerId: "owner" } });
    expect(mocks.updateMany.mock.calls[0][0].where).toEqual({ id: "board", ownerId: "owner", revision: 3 });
    expect(result.revision).toBe(4);
    expect(result.document.events).toHaveLength(1);
  });
  it("rejects stale revisions and concurrent update losses", async () => {
    await expect(changeSongBoard("owner", "board", { revision: 2, action: "rename", title: "changed" })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(changeSongBoard("owner", "board", { revision: 3, action: "rename", title: "changed" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("makes retries idempotent but rejects reused IDs with changed choices", async () => {
    const doc = document(); doc.events.push({ id: "one", leftId: "a", rightId: "b", result: "DRAW" });
    mocks.findFirst.mockResolvedValue(board(doc));
    const vote = { revision: 2, action: "vote", eventId: "one", leftId: "a", rightId: "b", result: "DRAW" };
    expect((await changeSongBoard("owner", "board", vote)).document.events).toHaveLength(1);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    await expect(changeSongBoard("owner", "board", { ...vote, result: "LEFT_WIN" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("rejects self-matches, nonparticipants and invalid tiers", async () => {
    for (const value of [
      { action: "vote", eventId: "one", leftId: "a", rightId: "a", result: "DRAW" },
      { action: "vote", eventId: "one", leftId: "a", rightId: "other", result: "DRAW" },
      { action: "tier", trackId: "a", tier: "ss" },
      { action: "candidates", trackIds: ["a", "a"] }
    ]) await expect(changeSongBoard("owner", "board", { revision: 3, ...value })).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("publishes a detached snapshot without audio, and regular writes leave it alone", async () => {
    const doc = document(); doc.tracks[0].source = { kind: "url", url: "https://example.com/secret-audio.mp3" };
    mocks.findFirst.mockResolvedValue(board(doc));
    await changeSongBoard("owner", "board", { revision: 3, action: "publish" });
    const data = mocks.updateMany.mock.calls[0][0].data;
    expect(data.shareToken).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(data.snapshot)).not.toContain("secret-audio");
    await changeSongBoard("owner", "board", { revision: 3, action: "tier", trackId: "a", tier: "s" });
    expect(mocks.updateMany.mock.calls[1][0].data).not.toHaveProperty("snapshot");
  });
  it("only removes audio after a successful removal commit", async () => {
    const doc = document(); doc.tracks[0].source = { kind: "upload", key: "old.wav", mime: "audio/wav", bytes: 100 };
    doc.events.push({ id: "one", leftId: "a", rightId: "b", result: "DRAW" });
    mocks.findFirst.mockResolvedValue(board(doc));
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(changeSongBoard("owner", "board", { revision: 3, action: "remove", trackId: "a" })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.discardAudio).not.toHaveBeenCalled();
    const result = await changeSongBoard("owner", "board", { revision: 3, action: "remove", trackId: "a" });
    expect(result.document.events).toHaveLength(0);
    expect(mocks.discardAudio).toHaveBeenCalledWith("old.wav");
  });
  it("keeps old audio on replacement conflicts and enforces cumulative storage quota", async () => {
    const doc = document(); doc.tracks[0].source = { kind: "upload", key: "old.wav", mime: "audio/wav", bytes: 250 * 1024 * 1024 };
    mocks.findFirst.mockResolvedValue(board(doc));
    const current = await ownedSongBoard("owner", "board");
    const replacement = { ...doc.tracks[0], source: { kind: "upload" as const, key: "new.wav", mime: "audio/wav", bytes: 100 } };
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(addSongTrack(current, 3, replacement)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.discardAudio).not.toHaveBeenCalled();
    await expect(addSongTrack(current, 3, { ...replacement, id: "new" })).rejects.toMatchObject({ statusCode: 400 });
    await addSongTrack(current, 3, replacement);
    expect(mocks.discardAudio).toHaveBeenCalledWith("old.wav");
  });
  it("requires the current revision to delete the board", async () => {
    await expect(deleteSongBoard("owner", "board", { revision: 4 })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    await deleteSongBoard("owner", "board", { revision: 3 });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "board", ownerId: "owner", revision: 3 } });
  });
  it("persists a complete tier order atomically and preserves voting history", async () => {
    const doc = document();
    doc.events.push({ id: "vote", leftId: "a", rightId: "b", result: "LEFT_WIN" });
    mocks.findFirst.mockResolvedValue(board(doc));
    const ranking = (await import("@/lib/anisong/engine")).rankSongs(doc);
    const rows = Object.fromEntries([
      ...["s", "a", "b", "c", "d"].map(tier => [tier, ranking.tiers[tier].map(s => s.animeId)]),
      ["pending", ranking.pending.map(s => s.animeId)]
    ]) as Record<string, string[]>;
    for (const ids of Object.values(rows)) {
      const index = ids.indexOf("b");
      if (index !== -1) ids.splice(index, 1);
    }
    rows.s.unshift("b");
    const result = await changeSongBoard("owner", "board", { revision: 3, action: "tierLayout", rows });
    expect(result.document.events).toEqual(doc.events);
    expect(result.document.manualTiers.a).toBe("s");
    expect(result.document.manualTiers.b).toBe("s");
    expect(result.document.manualOrder?.s).toEqual(["b", "a"]);
    expect(mocks.updateMany.mock.calls[0][0].where.revision).toBe(3);
    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty("snapshot");
  });
  it("rejects stale tier edits before validating removed song IDs", async () => {
    await expect(changeSongBoard("owner", "board", { revision: 2, action: "tierLayout", rows: { s: ["missing"] } }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("resets tier edits without touching scores and preserves excluded overrides", async () => {
    const doc = document();
    doc.tracks.push(song("c"));
    doc.candidateIds = ["a", "b"];
    doc.manualTiers = { a: "a", c: "s" };
    doc.manualOrder = { a: ["a"], s: ["c"] };
    doc.events.push({ id: "vote", leftId: "a", rightId: "b", result: "DRAW" });
    mocks.findFirst.mockResolvedValue(board(doc));
    const result = await changeSongBoard("owner", "board", { revision: 3, action: "tierReset" });
    expect(result.document.manualTiers).toEqual({ c: "s" });
    expect(result.document.manualOrder?.s).toEqual(["c"]);
    expect(result.document.events).toEqual(doc.events);
    expect(result.document.candidateIds).toEqual(["a", "b"]);
  });

});
