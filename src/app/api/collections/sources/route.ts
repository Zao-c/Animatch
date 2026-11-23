import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET(request: Request) { try { const user = await requireCurrentUser(); const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
const seasons = await prisma.battleSeason.findMany({ where: { pool: { deletedAt: null, OR: [{ visibility: "PUBLIC" }, { creatorId: user.id }] }, ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { pool: { name: { contains: q, mode: "insensitive" } } }] } : {}) }, select: { id: true, title: true, status: true, startsAt: true, endsAt: true, poolId: true, pool: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
return ok(seasons, { headers: { "Cache-Control": "private, no-store" } }); } catch(e) { return fromError(e); } }
