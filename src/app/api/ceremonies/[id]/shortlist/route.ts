import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { awardBody, awardHeaders } from "@/lib/award-http";
import { saveShortlist } from "@/lib/award-service";
export const dynamic = "force-dynamic";
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try { const user = await requireCurrentUser(); return ok(await saveShortlist(params.id, user.id, await awardBody(request)), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
