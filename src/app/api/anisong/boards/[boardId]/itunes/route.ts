import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { ownedSongBoard, addSongTrack } from "@/lib/anisong/service";
import { songJson } from "@/lib/anisong/audio-storage";
import { objectInput, revisionInput, textInput } from "@/lib/anisong/validation";
import { lookupItunes, itunesId, itunesCountry } from "@/lib/anisong/itunes/api";
import { limitNetease } from "@/lib/anisong/netease/limits";
import type { SongDocument, SongTrack } from "@/lib/anisong/types";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: { boardId: string } }) {
  try {
    const user = await requireCurrentUser(); limitNetease(user.id, "itunes-link", 20);
    const input = objectInput(await songJson(request)); const revision = revisionInput(input.revision);
    const board = await ownedSongBoard(user.id, params.boardId);
    if (board.revision !== revision) throw new AppError("曲单已更新，请重新载入后匹配", 409);
    const id = textInput(input.trackId, "歌曲编号", 80, true);
    const track = (board.document as unknown as SongDocument).tracks.find(t => t.id === id);
    if (!track) throw new AppError("歌曲不存在", 404);
    if (input.remove === true) return ok(await addSongTrack(board, revision, { ...track, itunes: null, source: track.source.kind === "itunes" ? { kind: "none" } : track.source }));
    const song = await lookupItunes(itunesId(input.itunesId), itunesCountry(input.country));
    if (!song.hasPreview) throw new AppError("此版本没有 iTunes 试听，请选择其他版本", 422);
    const source: SongTrack["source"] = track.source.kind === "none" || track.source.kind === "itunes" ? { kind: "itunes", id: song.reference.id, country: song.reference.country } : track.source;
    return ok(await addSongTrack(board, revision, { ...track, source, itunes: song.reference, coverUrl: track.coverUrl || song.coverUrl }));
  } catch (error) { return fromError(error); }
}
