import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { awardHeaders } from "@/lib/award-http";
import { getNominationSuggestions } from "@/lib/award-service";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try { await requireCurrentUser(); return ok(await getNominationSuggestions(params.id), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
