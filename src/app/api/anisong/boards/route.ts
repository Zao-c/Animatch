import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { createSongBoard } from "@/lib/anisong/service";
import { songJson } from "@/lib/anisong/audio-storage";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireCurrentUser();
    const boards = await prisma.songBoard.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true } });
    return ok({ boards }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return fromError(e); }
}
export async function POST(request: Request) {
  try { const user = await requireCurrentUser(); return ok(await createSongBoard(user.id, await songJson(request)), { status: 201 }); }
  catch (e) { return fromError(e); }
}
