import { PoolStatus } from "@prisma/client";
import { forbidden, notFound, ok, serverError } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: {
    poolId: string;
  };
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getOrCreateDevUser();
    const pool = await prisma.customPool.findUnique({
      where: {
        id: context.params.poolId
      }
    });

    if (pool === null) {
      return notFound("Pool not found");
    }

    if (pool.creatorId !== user.id) {
      return forbidden("Pool does not belong to the current dev user");
    }

    const restored = await prisma.customPool.update({
      where: {
        id: pool.id
      },
      data: {
        status: PoolStatus.DRAFT,
        deletedAt: null
      }
    });

    return ok(restored);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Pool restore failed");
  }
}
