import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

import { AppError } from "@/lib/app-error";
export async function PATCH(request: Request) { try { const user = await requireCurrentUser(); const body = await request.json();
if (typeof body.tasteProfilePublic !== "boolean" || typeof body.allowTasteMatching !== "boolean") throw new AppError("设置无效", 400);
await prisma.user.update({ where: { id: user.id }, data: { tasteProfilePublic: body.tasteProfilePublic, allowTasteMatching: body.tasteProfilePublic && body.allowTasteMatching } }); return ok({ saved: true }); } catch(e) { return fromError(e); } }
