import { requireCurrentUser } from "@/lib/auth-session";
import { ok, fromError } from "@/lib/api-response";
import { startSongTemplate } from "@/lib/anisong/shared/templates";
import { songJson } from "@/lib/anisong/audio-storage";
import { objectInput } from "@/lib/anisong/validation";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { templateId: string } }) {
  try { const user = await requireCurrentUser(); const input = request.headers.get("content-type")?.includes("application/json") ? objectInput(await songJson(request)) : {}; return ok(await startSongTemplate(user.id, params.templateId, input)); }
  catch (error) { return fromError(error); }
}
