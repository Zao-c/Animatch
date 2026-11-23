import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

import { findTasteMatches } from "@/lib/taste-service";
export async function GET(request: Request) { try { const user = await requireCurrentUser(); return ok(await findTasteMatches(user.id, new URL(request.url).searchParams.get("scope") ?? ""), { headers: { "Cache-Control": "private, no-store" } }); } catch(e) { return fromError(e); } }
