import { NextResponse } from "next/server";
import { PoolStatus } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import {
  AnimeCoverUploadError,
  deleteLocalAnimeCoverIfPresent,
  deleteLocalCustomItemIfPresent,
  saveCustomItemUpload
} from "@/lib/anime-cover-upload";
import { requireCurrentUser } from "@/lib/auth-session";
import { isAdminEditSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { canEditPoolContent } from "@/lib/pool-permissions";
import { deleteAnimeCoverCosObject } from "@/lib/server/cos-cover-cache";
import { enqueuePoolAnimeCoverCache } from "@/lib/server/pool-cover-cache";
import { serializePoolAnime } from "@/lib/pool-anime-serializer";
import { isUserGeneratedImageSource } from "@/lib/anime-display";

interface RouteContext {
  params: {
    poolId: string;
    animeId: string;
  };
}

const REPLACEABLE_SOURCES = new Set(["CUSTOM_UPLOAD", "TIERMAKER_IMPORT", "MANUAL"]);

/**
 * Replaces the stored artwork of a user-created item. Unlike the pool-level
 * cover override this updates every list that references the same item, so a
 * corrected image actually replaces the old one instead of stacking a new
 * duplicate entry on top of it.
 */
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

    if (pool.deletedAt !== null || pool.status === PoolStatus.ARCHIVED) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Archived pools cannot replace item images"
          }
        },
        { status: 409 }
      );
    }

    if (!canEditPoolContent(pool, user) && !(await isAdminEditSession(user))) {
      return forbidden("你没有权限管理这个番组。");
    }

    const existingEntry = await prisma.poolAnime.findUnique({
      where: {
        poolId_animeId: {
          poolId: pool.id,
          animeId: context.params.animeId
        }
      },
      include: {
        anime: true
      }
    });

    if (existingEntry === null) {
      return notFound("Anime is not in this pool");
    }

    const anime = existingEntry.anime;

    if (!isUserGeneratedImageSource(anime.source) && !REPLACEABLE_SOURCES.has(anime.source)) {
      return badRequest("内置作品库的图片不能替换，请使用封面覆盖。");
    }

    const formData = await request.formData().catch(() => null);

    if (formData === null) {
      return badRequest("Invalid multipart/form-data");
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return badRequest("File field is required");
    }

    const uploadPath = await saveCustomItemUpload({
      file,
      poolId: pool.id
    });

    const updatedAnime = await prisma.anime.update({
      where: {
        id: anime.id
      },
      data: {
        imageUrl: uploadPath,
        thumbnailUrl: uploadPath,
        imageSmallUrl: uploadPath,
        imageMediumUrl: uploadPath,
        imageLargeUrl: uploadPath,
        imageStatus: "OK",
        cachedCoverUrl: null,
        cachedCoverKey: null,
        cachedCoverSourceUrl: null,
        cachedCoverContentHash: null,
        cachedCoverWidth: null,
        cachedCoverHeight: null,
        cachedCoverFormat: null,
        cachedCoverBytes: null,
        cachedCoverAt: null
      }
    });

    const updated = await prisma.poolAnime.update({
      where: {
        id: existingEntry.id
      },
      data: {
        coverUrlOverride: null,
        overrideUpdatedAt: new Date()
      },
      include: {
        anime: true
      }
    });

    // Old artwork is unreachable once the row points at the new file.
    await deleteLocalCustomItemIfPresent(anime.imageUrl);
    await deleteLocalAnimeCoverIfPresent(existingEntry.coverUrlOverride);
    await deleteAnimeCoverCosObject(anime);

    enqueuePoolAnimeCoverCache(updatedAnime);

    const poolAnime = serializePoolAnime(updated);

    return ok({
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
