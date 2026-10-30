import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { ownedSongBoard } from "@/lib/anisong/service";
import type { SongDocument } from "@/lib/anisong/types";
import { readNeteaseAccount } from "@/lib/anisong/netease/accounts";
import { resolveNetease } from "@/lib/anisong/netease/api";
import { limitNetease } from "@/lib/anisong/netease/limits";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { boardId: string; trackId: string } }) {
  try {
    const user = await requireCurrentUser(); limitNetease(user.id, "playback");
    const board = await ownedSongBoard(user.id, params.boardId);
    const track = (board.document as unknown as SongDocument).tracks.find(t => t.id === params.trackId);
    if (!track || track.source.kind !== "netease") throw new AppError("网易云音源不存在", 404);
    const account = await readNeteaseAccount(user.id);
    return ok(await resolveNetease(track.source.id, account.cookie || ""), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fromError(error); }
}
