import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/anisong/boards/[boardId]/tracks/route";
import { emptySongDocument } from "@/lib/anisong/types";

const mocks = vi.hoisted(() => ({ owned: vi.fn(), add: vi.fn(), view: vi.fn(), audio: vi.fn(), discard: vi.fn(), cover: vi.fn(), deleteCover: vi.fn() }));
vi.mock("@/lib/auth-session", () => ({ requireCurrentUser: async () => ({ id: "owner" }) }));
vi.mock("@/lib/anisong/service", () => ({ ownedSongBoard: mocks.owned, addSongTrack: mocks.add, boardView: mocks.view }));
vi.mock("@/lib/anisong/audio-storage", () => ({ boundedBody: (request: Request) => request.arrayBuffer(), saveAudio: mocks.audio, discardAudio: mocks.discard }));
vi.mock("@/lib/anisong/cover-storage", () => ({ saveSongCover: mocks.cover }));
vi.mock("@/lib/anime-cover-upload", () => ({ deleteLocalAnimeCoverIfPresent: mocks.deleteCover }));
const key = "cd44999b-bf73-411c-bc4c-56f7ed00bad5";
const board = () => ({ id: "board", revision: 3, document: emptySongDocument() });
function request(form: FormData) { return POST(new Request("https://example.com/api", { method: "POST", body: form }), { params: { boardId: "board" } }); }
function form() { const data = new FormData(); data.set("revision", "3"); data.set("title", "星空"); return data; }
beforeEach(() => { vi.clearAllMocks(); mocks.owned.mockResolvedValue(board()); mocks.audio.mockResolvedValue({ kind: "upload", key: "audio.mp3", bytes: 12, mime: "audio/mpeg" }); mocks.add.mockResolvedValue({ revision: 4 }); });

describe("song uploads and import retries", () => {
  it("rejects a named empty file instead of silently creating a silent song", async () => {
    const data = form(); data.set("file", new File([], "empty.mp3", { type: "audio/mpeg" }));
    expect((await request(data)).status).toBe(400);
    expect(mocks.add).not.toHaveBeenCalled(); expect(mocks.audio).not.toHaveBeenCalled();
  });
  it("still permits a song without an audio selection", async () => {
    const data = form(); data.set("file", new File([], ""));
    expect((await request(data)).status).toBe(201);
    expect(mocks.add.mock.calls[0][2].source).toEqual({ kind: "none" });
  });
  it("replays a saved import without a duplicate write even with a stale revision", async () => {
    const saved = { ...board(), document: { ...emptySongDocument(), tracks: [{ id: "song", importKey: key }] } };
    mocks.owned.mockResolvedValue(saved); mocks.view.mockReturnValue({ revision: 3, document: saved.document });
    const data = form(); data.set("revision", "1"); data.set("importKey", key);
    const response = await request(data);
    expect(response.status).toBe(200); expect(mocks.add).not.toHaveBeenCalled(); expect(mocks.audio).not.toHaveBeenCalled();
    expect((await response.json()).data.document.tracks).toHaveLength(1);
  });
  it("saves the import key with its uploaded audio", async () => {
    const data = form(); data.set("importKey", key); data.set("file", new File([new Uint8Array(12)], "song.mp3"));
    expect((await request(data)).status).toBe(201);
    expect(mocks.add.mock.calls[0][2]).toMatchObject({ importKey: key, source: { kind: "upload" } });
  });
});
