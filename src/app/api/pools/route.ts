import { PoolStatus, Prisma, Visibility } from "@prisma/client";
import { badRequest, ok, serverError } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";
import { buildRankingProgress } from "@/lib/ranking-progress";

const VISIBILITIES = new Set<string>(Object.values(Visibility));
const LIST_STATUSES = new Set([
  "ACTIVE",
  "ARCHIVED",
  "EMPTY",
  "READY",
  "IN_PROGRESS",
  "STABLE"
]);
const LIST_SORTS = new Set(["UPDATED", "ANIME_COUNT", "COMPARISON_COUNT", "NAME"]);

interface CreatePoolBody {
  name?: unknown;
  description?: unknown;
  visibility?: unknown;
  tags?: unknown;
}

export async function GET(request: Request) {
  try {
    const user = await getOrCreateDevUser();
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim().toUpperCase() ?? "";
    const sort = url.searchParams.get("sort")?.trim().toUpperCase() || "UPDATED";

    if (status && !LIST_STATUSES.has(status)) {
      return badRequest("status is invalid");
    }

    if (!LIST_SORTS.has(sort)) {
      return badRequest("sort is invalid");
    }

    const where: Prisma.CustomPoolWhereInput = {
      creatorId: user.id,
    };

    if (status === "ARCHIVED") {
      where.OR = [{ status: PoolStatus.ARCHIVED }, { deletedAt: { not: null } }];
    } else if (status === "ACTIVE" || !includeArchived) {
      where.status = { not: PoolStatus.ARCHIVED };
      where.deletedAt = null;
    }

    if (q) {
      where.AND = [
        {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const pools = await prisma.customPool.findMany({
      where,
      include: {
        _count: {
          select: {
            poolAnime: true,
            poolComparisons: true
          }
        },
        poolAnime: {
          take: 20,
          select: {
            anime: {
              select: {
                source: true
              }
            }
          }
        },
        personalRuns: {
          where: {
            userId: user.id,
            isDefault: true,
            status: {
              not: "DELETED"
            }
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            status: true,
            updatedAt: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    const items = pools
      .map((pool) => serializePoolSummary(pool))
      .filter((pool) => {
        if (!status || status === "ACTIVE") {
          return true;
        }

        return pool.uiStatus === status;
      })
      .sort((left, right) => comparePoolSummary(left, right, sort));

    return ok({
      items
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Pool listing failed");
  }
}

function serializePoolSummary(pool: Prisma.CustomPoolGetPayload<{
  include: {
    _count: {
      select: {
        poolAnime: true;
        poolComparisons: true;
      };
    };
    poolAnime: {
      take: 20;
      select: {
        anime: {
          select: {
            source: true;
          };
        };
      };
    };
    personalRuns: {
      where: {
        userId: string;
        isDefault: true;
        status: {
          not: "DELETED";
        };
      };
      orderBy: {
        updatedAt: "desc";
      };
      take: 1;
      select: {
        id: true;
        status: true;
        updatedAt: true;
      };
    };
  };
}>) {
  const animeCount = pool._count.poolAnime;
  const comparisonCount = pool._count.poolComparisons;
  const progress = buildRankingProgress({
    totalItems: animeCount,
    effectiveComparisons: comparisonCount,
    totalComparisons: comparisonCount
  });
  const archived = pool.status === PoolStatus.ARCHIVED || pool.deletedAt !== null;
  const uiStatus = archived
    ? "ARCHIVED"
    : animeCount < 2
      ? "EMPTY"
      : comparisonCount === 0
        ? "READY"
        : progress.stage === "RELIABLE" || progress.stage === "HIGH_CONFIDENCE"
          ? "STABLE"
          : "IN_PROGRESS";

  return {
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
    archived,
    animeCount,
    comparisonCount,
    confidenceScore: Math.round(progress.progressRatio * 1000) / 10,
    uiStatus,
    uiStatusLabel: labelForPoolStatus(uiStatus),
    sourceType: deriveSourceType(pool.poolAnime.map((entry) => entry.anime.source)),
    defaultRunId: pool.personalRuns[0]?.id ?? null
  };
}

function labelForPoolStatus(status: string): string {
  switch (status) {
    case "ARCHIVED":
      return "已归档";
    case "EMPTY":
      return "未添加动画";
    case "READY":
      return "可开始";
    case "IN_PROGRESS":
      return "对决中";
    case "STABLE":
      return "已稳定";
    default:
      return "进行中";
  }
}

function deriveSourceType(sources: string[]): string {
  const uniqueSources = [...new Set(sources.filter(Boolean))];

  if (uniqueSources.length === 0) {
    return "UNKNOWN";
  }

  if (uniqueSources.length > 1) {
    return "MIXED";
  }

  return uniqueSources[0];
}

function comparePoolSummary(
  left: ReturnType<typeof serializePoolSummary>,
  right: ReturnType<typeof serializePoolSummary>,
  sort: string
): number {
  switch (sort) {
    case "ANIME_COUNT":
      return right.animeCount - left.animeCount || compareUpdatedAt(left, right);
    case "COMPARISON_COUNT":
      return right.comparisonCount - left.comparisonCount || compareUpdatedAt(left, right);
    case "NAME":
      return left.name > right.name ? 1 : left.name < right.name ? -1 : compareUpdatedAt(left, right);
    case "UPDATED":
    default:
      return compareUpdatedAt(left, right);
  }
}

function compareUpdatedAt(
  left: ReturnType<typeof serializePoolSummary>,
  right: ReturnType<typeof serializePoolSummary>
): number {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreatePoolBody | null;
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

  const visibility =
    typeof body?.visibility === "string" && VISIBILITIES.has(body.visibility)
      ? (body.visibility as Visibility)
      : Visibility.PRIVATE;
  const tags = normalizeTags(body?.tags);
  if (tags instanceof Error) {
    return badRequest(tags.message);
  }

  try {
    const user = await getOrCreateDevUser();
    const pool = await prisma.customPool.create({
      data: {
        creatorId: user.id,
        name,
        description,
        visibility,
        tags
      }
    });

    return ok(pool, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Pool creation failed");
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
