import { NextResponse } from "next/server";
import { PoolStatus, Prisma } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import {
  AnimeCoverUploadError,
  deleteLocalCustomItemIfPresent,
  saveCustomItemUpload
} from "@/lib/anime-cover-upload";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { ANIME_SOURCE } from "@/lib/anime-source";
import { serializePoolAnime } from "@/lib/pool-anime-serializer";

interface RouteContext {
  params: {
    poolId: string;
  };
}

export async function POST(request: Request, context: RouteContext) {
  let uploadPath: string | null = null;

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
            message: "Archived pools cannot upload custom items"
          }
        },
        { status: 409 }
      );
    }

    const formData = await request.formData().catch(() => null);

    if (formData === null) {
      return badRequest("Invalid multipart/form-data");
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return badRequest("File field is required");
    }

    const title = normalizeTitle(formData.get("title"), file.name);
    const note = normalizeOptionalString(formData.get("note"), 500);
    const tags = normalizeTags(formData.get("tags"));

    if (title instanceof Error) return badRequest(title.message);
    if (note instanceof Error) return badRequest(note.message);
    if (tags instanceof Error) return badRequest(tags.message);

    uploadPath = await saveCustomItemUpload({
      file,
      poolId: pool.id
    });

    const maxPosition = await prisma.poolAnime.aggregate({
      where: {
        poolId: pool.id
      },
      _max: {
        position: true
      }
    });
    const sourceId = `custom/${pool.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const anime = await prisma.anime.create({
      data: {
        title,
        titleCn: null,
        titleJa: null,
        titleEn: null,
        summary: note,
        imageUrl: uploadPath,
        thumbnailUrl: uploadPath,
        imageSmallUrl: uploadPath,
        imageMediumUrl: uploadPath,
        imageLargeUrl: uploadPath,
        tags,
        aliases: [],
        year: null,
        season: null,
        animeType: "IMAGE",
        studios: [],
        externalLinks: [],
        source: ANIME_SOURCE.CUSTOM_UPLOAD,
        sourceId,
        rawJson: {
          customUpload: true,
          poolId: pool.id,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          note
        } satisfies Prisma.InputJsonObject,
        imageStatus: "OK"
      }
    });
    const createdEntry = await prisma.poolAnime.create({
      data: {
        poolId: pool.id,
        animeId: anime.id,
        position: (maxPosition._max.position ?? 0) + 1,
        note
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
    if (uploadPath !== null) {
      await deleteLocalCustomItemIfPresent(uploadPath);
    }

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

function normalizeTitle(value: FormDataEntryValue | null, fileName: string): string | Error {
  const title =
    typeof value === "string" && value.trim()
      ? value.trim()
      : titleFromFileName(fileName);

  if (!title) {
    return "\u672a\u547d\u540d\u56fe\u7247";
  }

  if (title.length > 120) {
    return new Error("title must be 120 characters or fewer");
  }

  return title;
}

function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || "\u672a\u547d\u540d\u56fe\u7247";
}

function normalizeOptionalString(
  value: FormDataEntryValue | null,
  maxLength: number
): string | null | Error {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    return new Error(`field must be ${maxLength} characters or fewer`);
  }

  return trimmed || null;
}

function normalizeTags(value: FormDataEntryValue | null): string[] | Error {
  if (value === null || typeof value !== "string" || !value.trim()) {
    return [];
  }

  let rawTags: unknown;

  if (value.trim().startsWith("[")) {
    try {
      rawTags = JSON.parse(value);
    } catch {
      return new Error("tags JSON is invalid");
    }
  } else {
    rawTags = value.split(",");
  }

  if (!Array.isArray(rawTags)) {
    return new Error("tags must be a comma separated string or JSON array");
  }

  const tags = rawTags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);

  if (tags.length > 12) {
    return new Error("tags cannot contain more than 12 items");
  }

  if (tags.some((tag) => tag.length > 20)) {
    return new Error("tags must be 20 characters or fewer");
  }

  return tags;
}
