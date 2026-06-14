import { PoolStatus, Visibility } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { serializePoolAnime } from "@/lib/pool-anime-serializer";

interface RouteContext {
  params: {
    poolId: string;
  };
}

const VISIBILITIES = new Set<string>(Object.values(Visibility));

interface UpdatePoolBody {
  name?: unknown;
  description?: unknown;
  visibility?: unknown;
  tags?: unknown;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
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

    if (pool === null) {
      return notFound("Pool not found");
    }

    if (pool.creatorId !== user.id) {
      return forbidden("你没有权限访问这个番组。");
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
      deletedAt: pool.deletedAt,
      anime: pool.poolAnime.map(serializePoolAnime)
    });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as UpdatePoolBody | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return badRequest("name is required");
  }

  if (name.length > 80) {
    return badRequest("name must be 80 characters or fewer");
  }

  const description = normalizeDescription(body?.description);
  if (description instanceof Error) {
    return badRequest(description.message);
  }

  if (typeof body?.visibility !== "string" || !VISIBILITIES.has(body.visibility)) {
    return badRequest("visibility is invalid");
  }

  const tags = normalizeTags(body?.tags);
  if (tags instanceof Error) {
    return badRequest(tags.message);
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

    if (pool.creatorId !== user.id) {
      return forbidden("你没有权限访问这个番组。");
    }

    const updated = await prisma.customPool.update({
      where: {
        id: pool.id
      },
      data: {
        name,
        description,
        visibility: body.visibility as Visibility,
        tags
      }
    });

    return ok(updated);
  } catch (error) {
    return fromError(error);
  }
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
      return forbidden("你没有权限访问这个番组。");
    }

    if (pool.deletedAt === null || pool.status !== PoolStatus.ARCHIVED) {
      await prisma.customPool.update({
        where: {
          id: pool.id
        },
        data: {
          status: PoolStatus.ARCHIVED,
          deletedAt: pool.deletedAt ?? new Date()
        }
      });
    }

    return ok({ ok: true });
  } catch (error) {
    return fromError(error);
  }
}

function normalizeTags(value: unknown): string[] | Error {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

  if (tags.length > 10) {
    return new Error("tags cannot contain more than 10 items");
  }

  if (tags.some((tag) => tag.length > 20)) {
    return new Error("tags must be 20 characters or fewer");
  }

  return tags;
}

function normalizeDescription(value: unknown): string | null | Error {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const description = value.trim();
  if (description.length > 500) {
    return new Error("description must be 500 characters or fewer");
  }

  return description || null;
}
