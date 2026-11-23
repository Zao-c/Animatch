import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { awardBody, awardHeaders } from "@/lib/award-http";
import { ceremonyMembership } from "@/lib/award-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try { const user = await requireCurrentUser(); return ok(await ceremonyMembership(params.id, user.id), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try { const user = await requireCurrentUser(); return ok(await ceremonyMembership(params.id, user.id, await awardBody(request)), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
