import { randomUUID } from "crypto";
import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { ownedSongBoard, addSongTrack } from "@/lib/anisong/service";
import { boundedBody, saveAudio, discardAudio } from "@/lib/anisong/audio-storage";
import { trackInput, revisionInput, audioUrlInput, coverUrlInput } from "@/lib/anisong/validation";
import { MAX_AUDIO_BYTES, MAX_SONG_COVER_BYTES, MAX_TRACKS, type SongSource, type SongDocument } from "@/lib/anisong/types";
import { saveSongCover } from "@/lib/anisong/cover-storage";
import { deleteLocalAnimeCoverIfPresent } from "@/lib/anime-cover-upload";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: { boardId: string } }) {
  let uploadKey: string | null = null;
  let uploadedCover: string | null = null;
  try {
    const user = await requireCurrentUser();
    const board = await ownedSongBoard(user.id, params.boardId);
    const body = await boundedBody(request, MAX_AUDIO_BYTES + MAX_SONG_COVER_BYTES + 64 * 1024);
    const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData().catch(() => { throw new AppError("请使用有效的音频表单", 400); });
    const revision = revisionInput(form.get("revision"));
    if (revision !== board.revision) throw new AppError("曲单已更新，请重新载入后添加", 409);
    const document = board.document as unknown as SongDocument;
    const trackId = form.get("trackId");
    const previous = trackId ? document.tracks.find(t => t.id === trackId) : undefined;
    if (trackId && !previous) throw new AppError("歌曲不存在", 404);
    if (!previous && document.tracks.length >= MAX_TRACKS) throw new AppError(`每份曲单最多${MAX_TRACKS}首歌`, 400);
    const track = trackInput(Object.fromEntries(form.entries()));
    const id = previous?.id ?? randomUUID();
    const cover = form.get("cover");
    let coverUrl = form.has("coverUrl") ? coverUrlInput(form.get("coverUrl"), previous?.coverUrl) : previous?.coverUrl ?? null;
    if (cover instanceof File && cover.size > 0) {
      uploadedCover = await saveSongCover(cover, board.id, id);
      coverUrl = uploadedCover;
    }
    const file = form.get("file");
    const url = audioUrlInput(form.get("audioUrl"));
    let source: SongSource = previous?.source ?? { kind: "none" };
    if (file instanceof File && file.size > 0) {
      if (url && !(previous?.source.kind === "url" && previous.source.url === url)) throw new AppError("音频文件与直链请选择一种", 400);
      source = await saveAudio(file);
      uploadKey = source.key;
    } else if (url) source = { kind: "url", url };
    else if (form.has("audioUrl") && previous?.source.kind === "url") source = { kind: "none" };
    const result = await addSongTrack(board, revision, { ...track, id, source, coverUrl });
    uploadKey = null;
    uploadedCover = null;
    return ok(result, { status: 201 });
  } catch (e) {
    if (uploadKey) await discardAudio(uploadKey);
    if (uploadedCover) await deleteLocalAnimeCoverIfPresent(uploadedCover);
    return fromError(e);
  }
}
