import { forbidden, notFound, ok, serverError } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: {
    poolId: string;
    animeId: string;
  };
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getOrCreateDevUser();
    const pool = await prisma.customPool.findUnique({
      where: {
        id: context.params.poolId
      }
    });

    if (pool === null || pool.deletedAt !== null) {
      return notFound("Pool not found");
    }

    if (pool.creatorId !== user.id) {
      return forbidden("Pool does not belong to the current dev user");
    }

    const existingEntry = await prisma.poolAnime.findUnique({
      where: {
        poolId_animeId: {
          poolId: pool.id,
          animeId: context.params.animeId
        }
      }
    });

    if (existingEntry === null) {
      return notFound("Anime is not in this pool");
    }

    await prisma.poolAnime.delete({
      where: {
        id: existingEntry.id
      }
    });

    return ok({
      ok: true
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Removing anime failed");
  }
}
