import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { ok, fromError } from "@/lib/api-response";
import { songJson } from "@/lib/anisong/audio-storage";
import { objectInput } from "@/lib/anisong/validation";
import { publishSongTemplate } from "@/lib/anisong/shared/templates";
import { ownedSongBoard } from "@/lib/anisong/service";
import { limitNetease } from "@/lib/anisong/netease/limits";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(_request: Request, { params }: { params: { boardId: string } }) {
  try { const user = await requireCurrentUser(); await ownedSongBoard(user.id, params.boardId); return ok(await prisma.songTemplate.findUnique({ where: { sourceBoardId: params.boardId }, select: { id: true, active: true, revision: true } })); }
  catch (error) { return fromError(error); }
}
export async function POST(request: Request, { params }: { params: { boardId: string } }) {
  try { const user = await requireCurrentUser(); limitNetease(user.id, "publish", 3); return ok(await publishSongTemplate(user.id, params.boardId, objectInput(await songJson(request)))); }
  catch (error) { return fromError(error); }
}
