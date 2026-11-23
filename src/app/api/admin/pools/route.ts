import { PoolStatus, Visibility } from "@prisma/client";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { requireSiteAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireSiteAdmin();

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const visibilityFilter = url.searchParams.get("visibility")?.toUpperCase() as
      | Visibility
      | null;
    const statusFilter = url.searchParams.get("status")?.toUpperCase() as
      | PoolStatus
      | null;
    const deleted = url.searchParams.get("deleted") ?? "active";
    const demo = url.searchParams.get("demo");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));

    const where: Record<string, unknown> = {};

    if (deleted === "deleted") {
      where.deletedAt = { not: null };
    } else if (deleted === "all") {
    } else {
      where.deletedAt = null;
    }

    if (
      visibilityFilter !== null &&
      Object.values(Visibility).includes(visibilityFilter as Visibility)
    ) {
      where.visibility = visibilityFilter;
    }

    if (
      statusFilter !== null &&
      Object.values(PoolStatus).includes(statusFilter as PoolStatus)
    ) {
      where.status = statusFilter;
    }

    if (demo === "true") {
      where.isOfficialDemo = true;
    } else if (demo === "false") {
      where.isOfficialDemo = false;
    }

    const qConditions: Record<string, unknown>[] = [];
    if (q.length > 0) {
      qConditions.push({ name: { contains: q, mode: "insensitive" } });
    }

    if (qConditions.length > 0) {
      where.OR = qConditions;
    }

    const [pools, total] = await Promise.all([
      prisma.customPool.findMany({
        where: where as any,
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
        },
        orderBy: {
          updatedAt: "desc"
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.customPool.count({ where: where as any })
    ]);

    const items = pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      description: pool.description,
      visibility: pool.visibility,
      status: pool.status,
      deletedAt: pool.deletedAt,
      isOfficialDemo: pool.isOfficialDemo,
      allowPublicEdit: pool.allowPublicEdit,
      allowCommunityMatch: pool.allowCommunityMatch,
      creator: pool.creator,
      animeCount: pool._count.poolAnime,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt
    }));

    return ok({
      items,
      total,
      page,
      limit
    });
  } catch (error) {
    return fromError(error);
  }
}
