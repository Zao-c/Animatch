import { PoolStatus } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";
import { serializePoolAnime } from "@/lib/pool-anime-serializer";

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

    if (pool === null) {
      return notFound("Pool not found");
    }

    if (pool.creatorId !== user.id) {
      return forbidden("Pool does not belong to the current dev user");
    }

    if (pool.deletedAt !== null || pool.status === PoolStatus.ARCHIVED) {
      return badRequest("Archived pools cannot edit anime display overrides");
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

    const updated = await prisma.poolAnime.update({
      where: {
        id: existingEntry.id
      },
      data: {
        displayTitleOverride: null,
        coverUrlOverride: null,
        animeTypeOverride: null,
        tagsOverride: [],
        overrideNote: null,
        overrideUpdatedAt: null
      },
      include: {
        anime: true
      }
    });
    const poolAnime = serializePoolAnime(updated);

    return ok({
      poolAnime,
      display: poolAnime.display
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Clearing anime display overrides failed");
  }
}
