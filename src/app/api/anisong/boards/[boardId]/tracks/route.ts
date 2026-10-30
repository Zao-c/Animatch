import { randomUUID } from "crypto";
import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { ownedSongBoard, addSongTrack, boardView } from "@/lib/anisong/service";
import { boundedBody, saveAudio, discardAudio } from "@/lib/anisong/audio-storage";
import { trackInput, revisionInput, audioUrlInput, coverUrlInput } from "@/lib/anisong/validation";
import { MAX_AUDIO_BYTES, MAX_SONG_COVER_BYTES, MAX_TRACKS, type SongSource, type SongDocument } from "@/lib/anisong/types";
import { saveSongCover } from "@/lib/anisong/cover-storage";
import { deleteLocalAnimeCoverIfPresent } from "@/lib/anime-cover-upload";
import { neteaseId, neteaseSong } from "@/lib/anisong/netease/api";
import { readNeteaseAccount } from "@/lib/anisong/netease/accounts";
import { limitNetease } from "@/lib/anisong/netease/limits";
import { lookupItunes, itunesId, itunesCountry } from "@/lib/anisong/itunes/api";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: { boardId: string } }) {
  let uploadKey: string | null = null;
  let uploadedCover: string | null = null;
  try {
    const user = await requireCurrentUser();
    const board = await ownedSongBoard(user.id, params.boardId);
    const body = await boundedBody(request, MAX_AUDIO_BYTES + MAX_SONG_COVER_BYTES + 64 * 1024);
    const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData().catch(() => { throw new AppError("请使用有效的音频表单", 400); });
    const importKey = form.get("importKey");
    if (importKey !== null && (typeof importKey !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(importKey))) throw new AppError("导入编号无效", 400);
    const document = board.document as unknown as SongDocument;
    const remoteId = form.has("neteaseId") ? neteaseId(form.get("neteaseId")) : null;
    const appleId = form.has("itunesId") ? itunesId(form.get("itunesId")) : null;
    const appleCountry = appleId ? itunesCountry(form.get("itunesCountry") || "JP") : null;
    if (appleId && remoteId) throw new AppError("请一次选择一个歌曲来源", 400);
    if (remoteId && !form.get("trackId") && document.tracks.some(t => t.source.kind === "netease" && t.source.id === remoteId)) return ok(boardView(board));
    if (appleId && !form.get("trackId") && document.tracks.some(t => t.itunes?.id === appleId && t.itunes.country === appleCountry)) return ok(boardView(board));
    // A batch item keeps its immutable import key when retrying a lost response.
    if (importKey && !form.get("trackId") && document.tracks.some(t => t.importKey === importKey)) return ok(boardView(board));
    const revision = revisionInput(form.get("revision"));
    if (revision !== board.revision) throw new AppError("曲单已更新，请重新载入后添加", 409);
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
    if (file instanceof File && file.name && file.size === 0) throw new AppError("所选音频文件为空，请重新选择", 400);
    const url = audioUrlInput(form.get("audioUrl"));
    let source: SongSource = form.get("removeAudio") === "true" ? { kind: "none" } : previous?.source ?? { kind: "none" };
    if (file instanceof File && file.size > 0) {
      if (url && !(previous?.source.kind === "url" && previous.source.url === url)) throw new AppError("音频文件与直链请选择一种", 400);
      source = await saveAudio(file);
      uploadKey = source.key;
    } else if (url) source = { kind: "url", url };
    else if (form.has("audioUrl") && previous?.source.kind === "url") source = { kind: "none" };
    if (remoteId) {
      if (previous || url || (file instanceof File && file.size) || uploadedCover) throw new AppError("网易云导入不能同时提交其他音源或封面", 400);
      limitNetease(user.id, "import", 20);
      const account = await readNeteaseAccount(user.id);
      const song = await neteaseSong(remoteId, account.cookie || "");
      track.title = song.title; track.artist = song.artist;
      source = { kind: "netease", id: song.id }; coverUrl = song.coverUrl;
    }
    let itunes = previous?.source.kind === "itunes" && form.get("removeAudio") === "true" ? null : previous?.itunes;
    if (appleId && appleCountry) {
      if (previous || url || (file instanceof File && file.size) || uploadedCover) throw new AppError("iTunes 导入不能同时提交其他音源或封面", 400);
      limitNetease(user.id, "itunes-import", 20);
      const song = await lookupItunes(appleId, appleCountry);
      if (!song.hasPreview) throw new AppError("此版本没有 iTunes 试听，请选择其他版本", 422);
      track.title = song.reference.title; track.artist = song.reference.artist;
      source = { kind: "itunes", id: appleId, country: appleCountry }; coverUrl = song.coverUrl; itunes = song.reference;
    }
    const result = await addSongTrack(board, revision, { ...track, id, source, coverUrl, ...(itunes ? { itunes } : {}), ...(previous?.importKey || importKey ? { importKey: previous?.importKey ?? String(importKey) } : {}) });
    uploadKey = null;
    uploadedCover = null;
    return ok(result, { status: 201 });
  } catch (e) {
    if (uploadKey) await discardAudio(uploadKey);
    if (uploadedCover) await deleteLocalAnimeCoverIfPresent(uploadedCover);
    return fromError(e);
  }
}
