import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { ownedSongBoard } from "@/lib/anisong/service";
import type { SongDocument, SongAudioProvider } from "@/lib/anisong/types";
import { resolveSongPlayback } from "@/lib/anisong/shared/playback";
import { limitNetease } from "@/lib/anisong/netease/limits";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { boardId: string; trackId: string } }) {
  try {
    const user = await requireCurrentUser(); limitNetease(user.id, "playback", 90);
    const board = await ownedSongBoard(user.id, params.boardId);
    const track = (board.document as unknown as SongDocument).tracks.find(t => t.id === params.trackId);
    if (!track) throw new AppError("歌曲不存在", 404);
    const provider = new URL(request.url).searchParams.get("provider") ?? (track.source.kind === "pool" ? "pool" : track.source.kind === "itunes" ? "itunes" : "original");
    if (!["pool", "itunes", "original"].includes(provider)) throw new AppError("音源选项无效", 400);
    return ok(await resolveSongPlayback(track, params.boardId, user.id, provider as SongAudioProvider), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fromError(error); }
}
