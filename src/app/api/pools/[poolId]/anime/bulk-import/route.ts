import { PoolStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import {
  importBangumiSubjects,
  toPublicAnime,
  type PublicAnime
} from "@/lib/anime-service";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { canAddAnime } from "@/lib/pool-permissions";
import { serializePoolAnime } from "@/lib/pool-anime-serializer";

interface RouteContext {
  params: {
    poolId: string;
  };
}

interface BulkImportBody {
  input?: unknown;
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as BulkImportBody | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";

  if (!input) {
    return badRequest("input is required");
  }

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

    if (pool.deletedAt !== null || pool.status === PoolStatus.ARCHIVED) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Archived pools cannot import anime"
          }
        },
        { status: 409 }
      );
    }

    if (!canAddAnime(pool, user)) {
      return forbidden("你没有权限管理这个番组。");
    }

    const importedResult = await importBangumiSubjects(input);
    const added: ReturnType<typeof serializePoolAnime>[] = [];
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

      added.push(serializePoolAnime(createdEntry));
    }

    return ok({
      added,
      skipped,
      failed: importedResult.failed
    });
  } catch (error) {
    return fromError(error);
  }
}
