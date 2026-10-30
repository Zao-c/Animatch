import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { startSongTemplate } from "@/lib/anisong/shared/templates";
export const dynamic = "force-dynamic";
export async function POST(_request: Request, { params }: { params: { templateId: string } }) {
  try { const user = await requireCurrentUser(); return ok(await startSongTemplate(user.id, params.templateId)); }
  catch (error) { return fromError(error); }
}
