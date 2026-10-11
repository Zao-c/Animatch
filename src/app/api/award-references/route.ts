import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { awardHeaders } from "@/lib/award-http";
import { getAwardCredits, getAwardReference, referenceId, referenceKind, searchAwardReferences } from "@/lib/award-reference-service";
import { AppError } from "@/lib/app-error";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireCurrentUser();
    const params = new URL(request.url).searchParams, kind = referenceKind(params.get("kind")), mode = params.get("mode") ?? "search";
    if (mode === "detail") return ok(await getAwardReference(kind, referenceId(params.get("id"))), { headers: awardHeaders });
    if (mode === "credits" && kind !== "subject") return ok(await getAwardCredits(referenceId(params.get("id")), kind), { headers: awardHeaders });
    if (mode !== "search") throw new AppError("资料查询方式无效", 400);
    return ok(await searchAwardReferences(params.get("q") ?? "", kind, params.get("music") === "true"), { headers: awardHeaders });
  } catch (e) { return fromError(e); }
}
