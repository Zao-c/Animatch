import { requireCurrentUser } from "@/lib/auth-session";
import { fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { ownedSongBoard } from "@/lib/anisong/service";
import { streamAudio } from "@/lib/anisong/audio-storage";
import type { SongDocument } from "@/lib/anisong/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { boardId: string; trackId: string } }) {
  try {
    const user = await requireCurrentUser();
    const board = await ownedSongBoard(user.id, params.boardId);
    const track = (board.document as unknown as SongDocument).tracks.find(t => t.id === params.trackId);
    if (!track || track.source.kind !== "upload") throw new AppError("音频不存在", 404);
    return await streamAudio(request, track.source);
  } catch (e) { return fromError(e); }
}
export const HEAD = GET;
