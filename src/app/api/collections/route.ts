import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

import { saveCollection } from "@/lib/collection-service";
export async function GET() { try { const user = await requireCurrentUser();
return ok(await prisma.animeCollection.findMany({ where: { ownerId: user.id }, select: { id: true, title: true, year: true, finalPoolId: true, _count: { select: { sources: true } } }, orderBy: { updatedAt: "desc" } }), { headers: { "Cache-Control": "private, no-store" } });
} catch(e) { return fromError(e); } }
export async function POST(request: Request) { try { const user = await requireCurrentUser(); return ok(await saveCollection(user.id, await request.json())); } catch(e) { return fromError(e); } }
