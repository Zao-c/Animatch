import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

import { createAnnualFinal } from "@/lib/collection-service";
export async function POST(_request: Request, { params }: { params: { id: string } }) { try { const user = await requireCurrentUser(); return ok(await createAnnualFinal(user.id, params.id)); } catch(e) { return fromError(e); } }
