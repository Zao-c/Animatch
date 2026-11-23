import { NextRequest } from "next/server";
import { badRequest, forbidden, fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { replaceSeasonCandidates, setSeasonAnimeHidden } from "@/lib/season-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { poolId: string; seasonId: string } }
) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json().catch(() => ({}));
    if (body.expectedUserId !== undefined && body.expectedUserId !== user.id) return forbidden("登录账号已变化，请重新加载赛季后再修改。");
    const animeIds = Array.isArray(body.animeIds)
      ? body.animeIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const result = await setSeasonAnimeHidden(
      params.poolId,
      params.seasonId,
      user.id,
      animeIds,
      body.isHidden !== false
    );
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { poolId: string; seasonId: string } }) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json().catch(() => null);
    if (!body || ![body.includedAnimeIds, body.expectedAnimeIds, body.expectedHiddenAnimeIds].every((ids) => Array.isArray(ids) && ids.length <= 10000 && ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 200))) return badRequest("作品选择格式不正确，请重新加载后再试。");
    if (body.expectedUserId !== user.id) return forbidden("登录账号已变化，请重新加载赛季后再修改。");
    return ok(await replaceSeasonCandidates(params.poolId, params.seasonId, user.id, body));
  } catch (error) { return fromError(error); }
}
