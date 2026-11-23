import { NextRequest } from "next/server";
import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { setSeasonAnimeHidden } from "@/lib/season-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { poolId: string; seasonId: string } }
) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json().catch(() => ({}));
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
