import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api-response";
import {
  importBangumiSubjects,
  toPublicAnime,
  type PublicAnime
} from "@/lib/anime-service";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: {
    poolId: string;
  };
}

interface BulkImportBody {
  input?: unknown;
}

interface AddedPoolAnime {
  id: string;
  poolId: string;
  animeId: string;
  position: number;
  anime: PublicAnime;
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as BulkImportBody | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";

  if (!input) {
    return badRequest("input is required");
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

    const importedResult = await importBangumiSubjects(input);
    const added: AddedPoolAnime[] = [];
    const skipped: PublicAnime[] = [];

    for (const anime of importedResult.imported) {
      const existingEntry = await prisma.poolAnime.findUnique({
        where: {
          poolId_animeId: {
            poolId: pool.id,
            animeId: anime.id
          }
        }
      });

      if (existingEntry !== null) {
        skipped.push(toPublicAnime(anime));
        continue;
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

      added.push({
        id: createdEntry.id,
        poolId: createdEntry.poolId,
        animeId: createdEntry.animeId,
        position: createdEntry.position,
        anime: toPublicAnime(createdEntry.anime)
      });
    }

    return ok({
      added,
      skipped,
      failed: importedResult.failed
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Pool bulk import failed");
  }
}
