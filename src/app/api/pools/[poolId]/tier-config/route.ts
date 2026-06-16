import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth-session";
import { canManagePool } from "@/lib/pool-permissions";
import { isAdminEditSession } from "@/lib/admin-auth";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { normalizeTierConfig, DEFAULT_TIER_CONFIG, type PoolTierConfig } from "@/lib/tier-config";

export async function GET(
  _request: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const pool = await prisma.customPool.findUnique({
      where: { id: params.poolId },
      select: {
        tierConfig: true,
        visibility: true,
        creatorId: true,
        deletedAt: true
      }
    });

    if (pool === null || pool.deletedAt !== null) {
      return notFound("Pool not found");
    }

    if (pool.visibility === "PRIVATE") {
      const user = await requireCurrentUser();
      if (pool.creatorId !== user.id && !(await isAdminEditSession(user))) {
        return forbidden("你没有权限访问这个番组的配置。");
      }
    }

    const tierConfig = (pool.tierConfig ?? null) as PoolTierConfig | null;

    return ok({ tierConfig });
  } catch (error) {
    return fromError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const user = await requireCurrentUser();

    const pool = await prisma.customPool.findUnique({
      where: { id: params.poolId }
    });

    if (pool === null || pool.deletedAt !== null) {
      return notFound("Pool not found");
    }

    if (!canManagePool(pool, user) && !(await isAdminEditSession(user))) {
      return forbidden("你没有权限管理这个番组。");
    }

    if (pool.status === "ARCHIVED") {
      return forbidden("已归档的番组不能修改。");
    }

    const body = await request.json().catch(() => null);

    const result = normalizeTierConfig(body?.tierConfig);

    if (!result.ok) {
      return badRequest(result.error);
    }

    await prisma.customPool.update({
      where: { id: pool.id },
      data: {
        tierConfig: result.config as unknown as Prisma.InputJsonValue
      }
    });

    return ok({ tierConfig: result.config });
  } catch (error) {
    return fromError(error);
  }
}
