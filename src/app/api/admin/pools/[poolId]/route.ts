import { PoolStatus, Visibility } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { requireSiteAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

const VISIBILITIES = new Set<string>(Object.values(Visibility));

interface RouteContext {
  params: {
    poolId: string;
  };
}

interface AdminPoolEditBody {
  name?: unknown;
  description?: unknown;
  tags?: unknown;
  visibility?: unknown;
  archive?: unknown;
  restoreArchived?: unknown;
  softDelete?: unknown;
  restoreDeleted?: unknown;
  confirm?: unknown;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireSiteAdmin();

    const body = (await request.json().catch(() => null)) as AdminPoolEditBody | null;
    if (body === null) {
      return badRequest("Invalid JSON body");
    }

    const pool = await prisma.customPool.findUnique({
      where: {
        id: context.params.poolId
      }
    });

    if (pool === null) {
      return notFound("Pool not found");
    }

    const dangerousOperationCount = [
      body.archive === true,
      body.softDelete === true,
      body.restoreDeleted === true,
      body.restoreArchived === true
    ].filter(Boolean).length;

    if (dangerousOperationCount > 1) {
      return badRequest("Only one dangerous operation may be requested at a time");
    }

    const isDangerousOp = dangerousOperationCount === 1;

    if (isDangerousOp) {
      if (typeof body.confirm !== "string" || body.confirm !== "CONFIRM") {
        return badRequest("Dangerous operations require confirm: 'CONFIRM'");
      }
    }

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length === 0) {
        return badRequest("name is required");
      }
      if (name.length > 80) {
        return badRequest("name must be 80 characters or fewer");
      }
      data.name = name;
    }

    if (typeof body.description === "string") {
      const desc = body.description.trim();
      if (desc.length > 500) {
        return badRequest("description must be 500 characters or fewer");
      }
      data.description = desc || null;
    }

    if (Array.isArray(body.tags)) {
      const tags = (body.tags as unknown[])
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

      if (tags.length > 10) {
        return badRequest("tags cannot contain more than 10 items");
      }

      data.tags = tags;
    }

    if (typeof body.visibility === "string" && VISIBILITIES.has(body.visibility)) {
      data.visibility = body.visibility as Visibility;
    }

    if (body.archive === true) {
      data.status = PoolStatus.ARCHIVED;
    }

    if (body.restoreArchived === true) {
      if (pool.deletedAt !== null) {
        return badRequest("Cannot restore an archived pool that is soft-deleted. Restore the deleted pool first.");
      }
      data.status = PoolStatus.DRAFT;
    }

    if (body.softDelete === true) {
      data.deletedAt = new Date();
      data.status = PoolStatus.ARCHIVED;
    }

    if (body.restoreDeleted === true) {
      data.deletedAt = null;
    }

    const updated = await prisma.customPool.update({
      where: {
        id: pool.id
      },
      data: data as any,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        },
        _count: {
          select: {
            poolAnime: true
          }
        }
      }
    });

    return ok({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      visibility: updated.visibility,
      status: updated.status,
      deletedAt: updated.deletedAt,
      isOfficialDemo: updated.isOfficialDemo,
      allowPublicEdit: updated.allowPublicEdit,
      allowCommunityMatch: updated.allowCommunityMatch,
      tags: updated.tags,
      creator: updated.creator,
      animeCount: updated._count.poolAnime,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    });
  } catch (error) {
    return fromError(error);
  }
}
