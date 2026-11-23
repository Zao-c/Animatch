import { AppError } from "@/lib/app-error";
import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { canPlayPool } from "@/lib/pool-permissions";

interface RouteContext {
  params: {
    poolId: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const pool = await prisma.customPool.findUnique({
      where: {
        id: context.params.poolId
      }
    });

    if (pool === null) {
      throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
    }

    if (!canPlayPool(pool, user)) {
      throw new AppError("你没有权限访问这个番组。", 403, "POOL_FORBIDDEN");
    }

    const runs = await prisma.personalRun.findMany({
      where: {
        userId: user.id,
        poolId: pool.id,
        deletedAt: null
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return ok({
      items: runs
    });
  } catch (error) {
    return fromError(error);
  }
}
