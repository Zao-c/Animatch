import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth-session";
import { canManagePool } from "@/lib/pool-permissions";
import { isAdminEditSession } from "@/lib/admin-auth";
import { badRequest, conflict, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { normalizeTierConfig, type PoolTierConfig } from "@/lib/tier-config";

export async function GET(
  _request: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const pool = await prisma.customPool.findUnique({
      where: { id: params.poolId },
      select: {
        tierConfig: true,
        updatedAt: true,
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

    return ok({ tierConfig, updatedAt: pool.updatedAt.toISOString() });
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

    if (typeof body?.expectedUpdatedAt !== "string") {
      return badRequest("tier config version is required");
    }

    const expectedUpdatedAt = new Date(body.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.getTime())) {
      return badRequest("tier config version is invalid");
    }

    const result = normalizeTierConfig(body?.tierConfig);

    if (!result.ok) {
      return badRequest(result.error);
    }

    const updateResult = await prisma.customPool.updateMany({
      where: { id: pool.id, updatedAt: expectedUpdatedAt },
      data: {
        tierConfig: result.config as unknown as Prisma.InputJsonValue
      }
    });

    if (updateResult.count === 0) {
      return conflict("Tier 配置已被其他操作更新，请刷新后再保存。");
    }

    const updated = await prisma.customPool.findUnique({
      where: { id: pool.id },
      select: { updatedAt: true }
    });

    return ok({ tierConfig: result.config, updatedAt: updated?.updatedAt.toISOString() ?? new Date().toISOString() });
  } catch (error) {
    return fromError(error);
  }
}
