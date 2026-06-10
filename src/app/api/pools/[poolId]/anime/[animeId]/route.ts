import { PoolStatus, Prisma } from "@prisma/client";
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

const ANIME_TYPES = new Set([
  "TV",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "MUSIC",
  "CM",
  "PV",
  "UNKNOWN"
]);

interface OverrideBody {
  displayTitleOverride?: unknown;
  coverUrlOverride?: unknown;
  animeTypeOverride?: unknown;
  tagsOverride?: unknown;
  overrideNote?: unknown;
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as OverrideBody | null;

  if (body === null) {
    return badRequest("Invalid JSON body");
  }

  const data = buildOverrideUpdate(body);
  if (data instanceof Error) {
    return badRequest(data.message);
  }

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
        ...data,
        overrideUpdatedAt: new Date()
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
    return serverError(error instanceof Error ? error.message : "Updating anime display failed");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

    await prisma.poolAnime.delete({
      where: {
        id: existingEntry.id
      }
    });

    return ok({
      ok: true
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Removing anime failed");
  }
}

function buildOverrideUpdate(body: OverrideBody): Prisma.PoolAnimeUpdateInput | Error {
  const data: Prisma.PoolAnimeUpdateInput = {};

  if (Object.prototype.hasOwnProperty.call(body, "displayTitleOverride")) {
    const value = nullableTrimmedString(body.displayTitleOverride, "displayTitleOverride");
    if (value instanceof Error) return value;
    if (value !== null && value.length > 120) {
      return new Error("displayTitleOverride must be 120 characters or fewer");
    }
    data.displayTitleOverride = value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "coverUrlOverride")) {
    const value = nullableTrimmedString(body.coverUrlOverride, "coverUrlOverride");
    if (value instanceof Error) return value;
    if (value !== null && !isHttpUrl(value)) {
      return new Error("coverUrlOverride must be an http or https URL");
    }
    data.coverUrlOverride = value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "animeTypeOverride")) {
    const value = nullableTrimmedString(body.animeTypeOverride, "animeTypeOverride");
    if (value instanceof Error) return value;
    if (value !== null && !ANIME_TYPES.has(value)) {
      return new Error("animeTypeOverride is invalid");
    }
    data.animeTypeOverride = value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "tagsOverride")) {
    const tags = normalizeTags(body.tagsOverride);
    if (tags instanceof Error) return tags;
    data.tagsOverride = tags;
  }

  if (Object.prototype.hasOwnProperty.call(body, "overrideNote")) {
    const value = nullableTrimmedString(body.overrideNote, "overrideNote");
    if (value instanceof Error) return value;
    if (value !== null && value.length > 500) {
      return new Error("overrideNote must be 500 characters or fewer");
    }
    data.overrideNote = value;
  }

  return data;
}

function nullableTrimmedString(value: unknown, field: string): string | null | Error {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return new Error(`${field} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTags(value: unknown): string[] | Error {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return new Error("tagsOverride must be an array");
  }

  const tags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

  if (tags.length > 12) {
    return new Error("tagsOverride cannot contain more than 12 items");
  }

  if (tags.some((tag) => tag.length > 20)) {
    return new Error("tagsOverride items must be 20 characters or fewer");
  }

  return tags;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
