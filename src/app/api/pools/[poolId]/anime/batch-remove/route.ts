import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth-session";
import { isAdminEditSession } from "@/lib/admin-auth";
import { canEditPoolContent } from "@/lib/pool-permissions";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";

export async function POST(
  _request: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const user = await requireCurrentUser();

    const pool = await prisma.customPool.findUnique({
      where: {
        id: params.poolId
      }
    });

    if (pool === null || pool.deletedAt !== null) {
      return notFound("Pool not found");
    }

    if (!canEditPoolContent(pool, user) && !(await isAdminEditSession(user))) {
      return forbidden("你没有权限管理这个番组。");
    }

    const body = await _request.json();

    if (!Array.isArray(body?.poolAnimeIds) || body.poolAnimeIds.length === 0) {
      return badRequest("poolAnimeIds 必须是非空数组。");
    }

    const poolAnimeIds: string[] = body.poolAnimeIds;

    const existingEntries = await prisma.poolAnime.findMany({
      where: {
        id: { in: poolAnimeIds },
        poolId: pool.id
      },
      select: { id: true }
    });

    if (existingEntries.length === 0) {
      return badRequest("提供的作品 ID 均不属于当前番组。");
    }

    const existingIds = new Set(existingEntries.map((entry: { id: string }) => entry.id));
    const validIds = poolAnimeIds.filter((id) => existingIds.has(id));

    await prisma.poolAnime.deleteMany({
      where: {
        id: { in: validIds },
        poolId: pool.id
      }
    });

    return ok({
      removed: validIds.length
    });
  } catch (error) {
    return fromError(error);
  }
}
