import { ok, notFound, forbidden, fromError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { canReadPool } from "@/lib/pool-permissions";
import { getBattleSeasonImpact } from "@/lib/server/battle-season-impact";

export async function GET(
  _request: Request,
  context: { params: { poolId: string; seasonId: string } }
) {
  const { poolId, seasonId } = context.params;

  try {
    const user = await getCurrentUser();

    const pool = await prisma.customPool.findUnique({
      where: { id: poolId },
      select: { creatorId: true, visibility: true, deletedAt: true },
    });

    if (!pool || pool.deletedAt) {
      return notFound("番组不存在或已归档");
    }

    if (!canReadPool(pool as Parameters<typeof canReadPool>[0], user ?? undefined)) {
      return forbidden("你没有权限访问这个番组");
    }

    const result = await getBattleSeasonImpact(poolId, seasonId, user?.id ?? null);
    return ok(result);
  } catch (error) {
    if ((error as { message?: string })?.message === "SEASON_NOT_FOUND") {
      return notFound("赛季不存在");
    }
    return fromError(error);
  }
}
