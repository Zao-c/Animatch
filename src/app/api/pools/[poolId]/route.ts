import { forbidden, notFound, ok, serverError } from "@/lib/api-response";
import { toPublicAnime } from "@/lib/anime-service";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: {
    poolId: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getOrCreateDevUser();
    const pool = await prisma.customPool.findUnique({
      where: {
        id: context.params.poolId
      },
      include: {
        poolAnime: {
          orderBy: {
            position: "asc"
          },
          include: {
            anime: true
          }
        }
      }
    });

    if (pool === null || pool.deletedAt !== null) {
      return notFound("Pool not found");
    }

    if (pool.creatorId !== user.id) {
      return forbidden("Pool does not belong to the current dev user");
    }

    return ok({
      id: pool.id,
      creatorId: pool.creatorId,
      name: pool.name,
      description: pool.description,
      coverUrl: pool.coverUrl,
      visibility: pool.visibility,
      status: pool.status,
      tags: pool.tags,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
      anime: pool.poolAnime.map((entry) => ({
        id: entry.id,
        poolId: entry.poolId,
        animeId: entry.animeId,
        position: entry.position,
        note: entry.note,
        initialElo: entry.initialElo,
        createdAt: entry.createdAt,
        anime: toPublicAnime(entry.anime)
      }))
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Pool lookup failed");
  }
}
