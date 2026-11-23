import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { awardBody, awardHeaders } from "@/lib/award-http";
import { getAwardLive, voteAwardLive } from "@/lib/award-live-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try { const user = await requireCurrentUser(); return ok(await getAwardLive(params.id, user.id, false), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try { const user = await requireCurrentUser(); return ok(await voteAwardLive(params.id, user.id, await awardBody(request)), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
