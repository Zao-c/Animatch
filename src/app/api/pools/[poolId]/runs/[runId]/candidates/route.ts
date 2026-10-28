import { badRequest, forbidden, fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { getPersonalMatchCandidates, replacePersonalMatchCandidates } from "@/lib/personal-match-candidates";

type Context = { params: { poolId: string; runId: string } };

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireCurrentUser();
    return ok(await getPersonalMatchCandidates({ ...params, userId: user.id }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fromError(error); }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.includedAnimeIds) || body.includedAnimeIds.length > 10000 ||
      !body.includedAnimeIds.every((id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 200) ||
      typeof body.expectedVersion !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedVersion)) return badRequest("作品选择格式不正确，请重新加载清单。");
    if (body.expectedUserId !== user.id) return forbidden("登录账号已变化，请重新加载本轮对决。");
    return ok(await replacePersonalMatchCandidates({ ...params, userId: user.id }, body));
  } catch (error) { return fromError(error); }
}
