import { PoolStatus } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { deleteLocalAnimeCoverIfPresent } from "@/lib/anime-cover-upload";
import { requireCurrentUser } from "@/lib/auth-session";
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
    const user = await requireCurrentUser();
    const pool = await prisma.customPool.findUnique({
      where: {
        id: context.params.poolId
      }
    });

    if (pool === null) {
      return notFound("Pool not found");
    }

    if (pool.creatorId !== user.id) {
      return forbidden("你没有权限管理这个番组。");
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

    await deleteLocalAnimeCoverIfPresent(existingEntry.coverUrlOverride);

    return ok({
      poolAnime,
      display: poolAnime.display
    });
  } catch (error) {
    return fromError(error);
  }
}

