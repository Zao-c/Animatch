import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

import { getCollection, saveCollection } from "@/lib/collection-service";
import { AppError } from "@/lib/app-error";
export async function GET(_request: Request, { params }: { params: { id: string } }) { try { const user = await requireCurrentUser(); return ok(await getCollection(user.id, params.id), { headers: { "Cache-Control": "private, no-store" } }); } catch(e) { return fromError(e); } }
export async function PATCH(request: Request, { params }: { params: { id: string } }) { try { const user = await requireCurrentUser(); return ok(await saveCollection(user.id, await request.json(), params.id)); } catch(e) { return fromError(e); } }
export async function DELETE(_request: Request, { params }: { params: { id: string } }) { try { const user = await requireCurrentUser(); const result = await prisma.animeCollection.deleteMany({ where: { id: params.id, ownerId: user.id } }); if (!result.count) throw new AppError("组合不存在", 404); return ok({ deleted: true }); } catch(e) { return fromError(e); } }
