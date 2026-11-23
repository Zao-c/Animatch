import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { awardBody, awardHeaders } from "@/lib/award-http";
import { createCeremony, listCeremonies } from "@/lib/award-service";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const user = await requireCurrentUser(); return ok(await listCeremonies(user.id), { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
export async function POST(request: Request) {
  try { const user = await requireCurrentUser(); return ok(await createCeremony(user.id, await awardBody(request)), { status: 201, headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
