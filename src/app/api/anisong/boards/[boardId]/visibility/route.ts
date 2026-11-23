import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { songJson } from "@/lib/anisong/audio-storage";
import { getSongVisibility, setSongVisibility } from "@/lib/anisong/publication";
import { objectInput } from "@/lib/anisong/validation";
import { AppError } from "@/lib/app-error";
export const dynamic = "force-dynamic";
type Context = { params: { boardId: string } };
export async function GET(_request: Request, { params }: Context) {
  try { const user = await requireCurrentUser(); return ok(await getSongVisibility(user.id, params.boardId), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return fromError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await requireCurrentUser();
    const input = objectInput(await songJson(request));
    if (typeof input.isPublic !== "boolean") throw new AppError("公开状态必须为布尔值", 400);
    return ok(await setSongVisibility(user.id, params.boardId, input.isPublic));
  } catch (error) { return fromError(error); }
}
