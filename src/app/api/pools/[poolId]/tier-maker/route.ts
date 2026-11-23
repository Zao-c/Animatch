import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { getManualBoard, revokeManualBoardShare, saveManualBoard } from "@/lib/manual-board-service";
export const dynamic = "force-dynamic";
type Context = { params: { poolId: string } };
const headers = { "Cache-Control": "private, no-store" };
export async function GET(_request: Request, { params }: Context) {
  try { const user = await requireCurrentUser(); return ok(await getManualBoard(user.id, params.poolId), { headers }); }
  catch (error) { return fromError(error); }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const user = await requireCurrentUser();
    const input = await request.json();
    return ok(await saveManualBoard(user.id, params.poolId, input, input?.publish === true), { headers });
  } catch (error) { return fromError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { const user = await requireCurrentUser(); return ok(await revokeManualBoardShare(user.id, params.poolId, Number(request.headers.get("If-Match"))), { headers }); }
  catch (error) { return fromError(error); }
}
