import { beforeEach, describe, expect, it, vi } from "vitest";
import { addSongTrack, changeSongBoard } from "@/lib/anisong/service";
import { emptySongDocument, type SongDocument, type SongTrack } from "@/lib/anisong/types";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { songBoard: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } } }));
const song: SongTrack = { id: "a", title: "歌曲", artist: "", anime: "", kind: "OP", year: null, quarter: null, tags: [], clipStart: 0, clipLength: 30, source: { kind: "none" } };
const doc: SongDocument = { ...emptySongDocument(), tracks: [song, {...song, id: "b"}] };
const owned = () => ({ id: "run", ownerId: "viewer", templateId: "published", revision: 1, title: "原曲单", document: doc, shareToken: null, snapshot: null, updatedAt: new Date(), createdAt: new Date() });

describe("participant operations cannot edit the publisher's playlist", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findFirst.mockResolvedValue(owned()); });
  it("denies song edits, renames and removals before writing", async () => {
    for (const input of [{action:"rename", title:"改名"}, {action:"remove", trackId:"a"}, {action:"bulkEdit", trackIds:["a"], patch:{}}]) {
      await expect(changeSongBoard("viewer", "run", {revision:1, ...input})).rejects.toMatchObject({statusCode:403});
    }
    await expect(addSongTrack(owned() as never, 1, song)).rejects.toMatchObject({statusCode:403});
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
