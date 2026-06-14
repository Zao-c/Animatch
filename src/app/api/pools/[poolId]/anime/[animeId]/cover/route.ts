import { NextResponse } from "next/server";
import { PoolStatus } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import {
  AnimeCoverUploadError,
  deleteLocalAnimeCoverIfPresent,
  saveAnimeCoverUpload
} from "@/lib/anime-cover-upload";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { serializePoolAnime } from "@/lib/pool-anime-serializer";

interface RouteContext {
  params: {
    poolId: string;
    animeId: string;
  };
}

export async function POST(request: Request, context: RouteContext) {
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
      return forbidden("你没有权限访问这个番组。");
    }

    if (pool.deletedAt !== null || pool.status === PoolStatus.ARCHIVED) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Archived pools cannot upload anime covers"
          }
        },
        { status: 409 }
      );
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

    const formData = await request.formData().catch(() => null);

    if (formData === null) {
      return badRequest("Invalid multipart/form-data");
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return badRequest("File field is required");
    }

    const coverUrl = await saveAnimeCoverUpload({
      file,
      poolId: pool.id,
      animeId: context.params.animeId
    });
    const oldCoverUrlOverride = existingEntry.coverUrlOverride;
    const updated = await prisma.poolAnime.update({
      where: {
        id: existingEntry.id
      },
      data: {
        coverUrlOverride: coverUrl,
        overrideUpdatedAt: new Date()
      },
      include: {
        anime: true
      }
    });
    const poolAnime = serializePoolAnime(updated);

    await deleteLocalAnimeCoverIfPresent(oldCoverUrlOverride);

    return ok({
      ok: true,
      coverUrl,
      poolAnime,
      display: poolAnime.display
    });
  } catch (error) {
    if (error instanceof AnimeCoverUploadError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: error.message
          }
        },
        { status: error.status }
      );
    }

    return fromError(error);
  }
}
