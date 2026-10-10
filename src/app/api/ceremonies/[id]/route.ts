import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { awardBody, awardHeaders } from "@/lib/award-http";
import { freezeCeremony, getCeremony } from "@/lib/award-service";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try { const user = await requireCurrentUser(); return ok(await getCeremony(params.id, user.id), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try { const user = await requireCurrentUser(); return ok(await freezeCeremony(params.id, user.id, await awardBody(request)), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
