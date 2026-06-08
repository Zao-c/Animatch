import { Prisma } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api-response";
import { getOrImportAnimeByBgmId, toPublicAnime } from "@/lib/anime-service";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: {
    poolId: string;
  };
}

interface AddAnimeBody {
  animeId?: unknown;
  bgmId?: unknown;
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as AddAnimeBody | null;
  const animeId = typeof body?.animeId === "string" ? body.animeId.trim() : "";
  const bgmId = Number(body?.bgmId);

  if (!animeId && (!Number.isSafeInteger(bgmId) || bgmId <= 0)) {
    return badRequest("animeId or bgmId is required");
  }

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

    const anime = animeId
      ? await prisma.anime.findUnique({ where: { id: animeId } })
      : await getOrImportAnimeByBgmId(bgmId);

    if (anime === null) {
      return notFound("Anime not found");
    }

    const existingEntry = await prisma.poolAnime.findUnique({
      where: {
        poolId_animeId: {
          poolId: pool.id,
          animeId: anime.id
        }
      },
      include: {
        anime: true
      }
    });

    if (existingEntry !== null) {
      return ok({
        poolAnime: serializePoolAnime(existingEntry)
      });
    }

    const maxPosition = await prisma.poolAnime.aggregate({
      where: {
        poolId: pool.id
      },
      _max: {
        position: true
      }
    });

    const createdEntry = await prisma.poolAnime.create({
      data: {
        poolId: pool.id,
        animeId: anime.id,
        position: (maxPosition._max.position ?? 0) + 1
      },
      include: {
        anime: true
      }
    });

    return ok(
      {
        poolAnime: serializePoolAnime(createdEntry)
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return badRequest("Anime already exists in this pool");
    }

    return serverError(error instanceof Error ? error.message : "Adding anime failed");
  }
}

function serializePoolAnime(
  entry: Prisma.PoolAnimeGetPayload<{ include: { anime: true } }>
) {
  return {
    id: entry.id,
    poolId: entry.poolId,
    animeId: entry.animeId,
    position: entry.position,
    note: entry.note,
    initialElo: entry.initialElo,
    createdAt: entry.createdAt,
    anime: toPublicAnime(entry.anime)
  };
}
