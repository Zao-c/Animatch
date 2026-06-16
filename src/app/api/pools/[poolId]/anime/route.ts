import { Prisma } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { getOrImportAnimeByBgmId } from "@/lib/anime-service";
import { requireCurrentUser } from "@/lib/auth-session";
import { isAdminEditSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { canAddAnime } from "@/lib/pool-permissions";
import { serializePoolAnime } from "@/lib/pool-anime-serializer";

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
    const user = await requireCurrentUser();
    const pool = await prisma.customPool.findUnique({
      where: {
        id: context.params.poolId
      }
    });

    if (pool === null || pool.deletedAt !== null) {
      return notFound("Pool not found");
    }

    if (!canAddAnime(pool, user) && !(await isAdminEditSession(user))) {
      return forbidden("你没有权限管理这个番组。");
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

    return fromError(error);
  }
}
