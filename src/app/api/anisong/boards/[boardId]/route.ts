import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { ownedSongBoard, boardView, changeSongBoard, deleteSongBoard } from "@/lib/anisong/service";
import { songJson } from "@/lib/anisong/audio-storage";
export const dynamic = "force-dynamic";
type Context = { params: { boardId: string } };
export async function GET(_request: Request, { params }: Context) {
  try { const user = await requireCurrentUser(); return ok(boardView(await ownedSongBoard(user.id, params.boardId)), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (e) { return fromError(e); }
}
export async function PATCH(request: Request, { params }: Context) {
  try { const user = await requireCurrentUser(); return ok(await changeSongBoard(user.id, params.boardId, await songJson(request))); }
  catch (e) { return fromError(e); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { const user = await requireCurrentUser(); return ok(await deleteSongBoard(user.id, params.boardId, await songJson(request))); }
  catch (e) { return fromError(e); }
}
