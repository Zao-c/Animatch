import { PoolComparisonResult, PoolStatus, Prisma, Visibility } from "@prisma/client";
import { badRequest, ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { getCurrentUser, requireCurrentUser, type FriendAuthUser } from "@/lib/auth-session";
import { getCommunitySummaries } from "@/lib/community-ranking-service";
import type { CommunityPoolSummary } from "@/lib/client-api";
import { prisma } from "@/lib/db";
import { formatAnimeSource } from "@/lib/anime-source";
import { formatPoolManagementStatus } from "@/lib/pool-labels";
import { getPoolPermissions } from "@/lib/pool-permissions";
import { buildRankingProgress } from "@/lib/ranking-progress";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";

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
    const user = await getCurrentUser();
    const url = new URL(request.url);
    const view = url.searchParams.get("view")?.trim().toLowerCase() ?? (user === null ? "public" : "mine");
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

    if (!["public", "mine", "all"].includes(view)) {
      return badRequest("view is invalid");
    }

    if ((view === "mine" || view === "all") && user === null) {
      throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
    }

    const where: Prisma.CustomPoolWhereInput =
      view === "public"
        ? {
            visibility: Visibility.PUBLIC
          }
        : view === "all" && user !== null
          ? {
              OR: [{ creatorId: user.id }, { visibility: Visibility.PUBLIC }]
            }
          : {
              creatorId: user!.id
            };

    if (status === "ARCHIVED") {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { OR: [{ status: PoolStatus.ARCHIVED }, { deletedAt: { not: null } }] }
      ];
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
          orderBy: {
            position: "asc"
          },
          select: {
            anime: {
              select: {
                source: true,
                imageUrl: true,
                thumbnailUrl: true,
                imageSmallUrl: true,
                imageMediumUrl: true,
                imageLargeUrl: true,
                cachedCoverUrl: true
              }
            }
          }
        },
        personalRuns: {
          where: {
            userId: user?.id ?? "__anonymous__",
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
            updatedAt: true,
            _count: {
              select: {
                comparisons: {
                  where: {
                    undoneAt: null,
                    result: {
                      in: [
                        PoolComparisonResult.LEFT_WIN,
                        PoolComparisonResult.RIGHT_WIN,
                        PoolComparisonResult.DRAW
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    const items = pools
      .map((pool) => serializePoolSummary(pool, user))
      .filter((pool) => {
        if (!status || status === "ACTIVE") {
          return true;
        }

        return pool.uiStatus === status;
      })
      .sort((left, right) => comparePoolSummary(left, right, sort));

    const publicPoolIds = items
      .filter((pool) => pool.visibility === "PUBLIC")
      .map((pool) => pool.id);

    if (publicPoolIds.length > 0) {
      try {
        const communityMap = await getCommunitySummaries(publicPoolIds);
        for (const pool of items) {
          const summary = communityMap.get(pool.id);
          if (summary !== undefined) {
            pool.communitySummary = {
              topAnimeTitle: summary.topAnimeTitle,
              topAnimeImageUrl: summary.topAnimeImageUrl,
              topAnimeId: summary.topAnimeId,
              participantCount: summary.participantCount,
              totalRuns: summary.totalRuns,
              sampleLabel: summary.sampleLabel
            };
          }
        }
      } catch {
        // silently skip community summaries
      }
    }

    return ok({ items });
  } catch (error) {
    return fromError(error);
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
      orderBy: {
        position: "asc";
      };
      select: {
        anime: {
          select: {
            source: true;
            imageUrl: true;
            thumbnailUrl: true;
            imageSmallUrl: true;
            imageMediumUrl: true;
            imageLargeUrl: true;
            cachedCoverUrl: true;
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
        _count: {
          select: {
            comparisons: true;
          };
        };
      };
    };
  };
}>, user: FriendAuthUser | null) {
  const animeCount = pool._count.poolAnime;
  const globalComparisonCount = pool._count.poolComparisons;
  const personalComparisonCount = user === null ? null : pool.personalRuns[0]?._count.comparisons ?? 0;
  const globalProgress = buildRankingProgress({
    totalItems: animeCount,
    effectiveComparisons: globalComparisonCount,
    totalComparisons: globalComparisonCount
  });
  const personalProgress =
    personalComparisonCount === null
      ? null
      : buildRankingProgress({
          totalItems: animeCount,
          effectiveComparisons: personalComparisonCount,
          totalComparisons: personalComparisonCount
        });
  const archived = pool.status === PoolStatus.ARCHIVED || pool.deletedAt !== null;
  const globalUiStatus = archived
    ? "ARCHIVED"
    : animeCount < 2
      ? "EMPTY"
      : globalComparisonCount === 0
        ? "READY"
        : globalProgress.stage === "RELIABLE" || globalProgress.stage === "HIGH_CONFIDENCE"
          ? "STABLE"
          : "IN_PROGRESS";
  const personalUiStatus =
    personalProgress === null
      ? null
      : archived
        ? "ARCHIVED"
        : animeCount < 2
          ? "EMPTY"
          : personalComparisonCount === 0
            ? "READY"
            : personalProgress.stage === "RELIABLE" || personalProgress.stage === "HIGH_CONFIDENCE"
              ? "STABLE"
              : "IN_PROGRESS";
  const uiStatus = personalUiStatus ?? globalUiStatus;

  const coverImages = deriveCoverImages(pool.poolAnime);

  return {
    id: pool.id,
    creatorId: pool.creatorId,
    name: pool.name,
    description: pool.description,
    coverUrl: pool.coverUrl,
    visibility: pool.visibility,
    status: pool.status,
    allowPublicEdit: pool.allowPublicEdit,
    allowCommunityMatch: pool.allowCommunityMatch,
    isOfficialDemo: pool.isOfficialDemo,
    tags: pool.tags,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    deletedAt: pool.deletedAt,
    archived,
    animeCount,
    comparisonCount: globalComparisonCount,
    globalComparisonCount,
    personalComparisonCount,
    confidenceScore: Math.round(globalProgress.progressRatio * 1000) / 10,
    personalConfidenceScore:
      personalProgress === null ? null : Math.round(personalProgress.progressRatio * 1000) / 10,
    uiStatus,
    uiStatusLabel: labelForPoolStatus(uiStatus),
    sourceType: deriveSourceType(pool.poolAnime.map((entry) => entry.anime.source)),
    coverImages: coverImages.map((image) => image.src),
    coverImageFallbacks: coverImages.map((image) => image.secondarySrc),
    defaultRunId: pool.personalRuns[0]?.id ?? null,
    permissions: getPoolPermissions(pool, user),
    communitySummary: null as CommunityPoolSummary | null
  };
}

function deriveCoverImages(
  entries: Array<{
    anime: {
      imageUrl: string | null;
      thumbnailUrl: string | null;
      imageSmallUrl: string | null;
      imageMediumUrl: string | null;
      imageLargeUrl: string | null;
      cachedCoverUrl: string | null;
    };
  }>
): Array<{ src: string; secondarySrc: string | null }> {
  return entries
    .map((entry) => {
      const displayUrl = getAnimeCoverUrl(entry.anime, { intent: "display" });
      const fallbackUrl = getAnimeCoverUrl(entry.anime, { intent: "export" });
      if (displayUrl === null) return null;
      return {
        src: displayUrl,
        secondarySrc: fallbackUrl !== displayUrl ? fallbackUrl : null
      };
    })
    .filter((image): image is { src: string; secondarySrc: string | null } => image !== null)
    .slice(0, 5);
}

function labelForPoolStatus(status: string): string {
  return formatPoolManagementStatus(status);
}

function deriveSourceType(sources: string[]): string {
  const uniqueSources = [...new Set(sources.filter(Boolean))];

  if (uniqueSources.length === 0) {
    return "\u8fdb\u884c\u4e2d";
  }

  if (uniqueSources.length > 1) {
    return "MIXED";
  }

  return formatAnimeSource(uniqueSources[0]);
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
    const user = await requireCurrentUser();
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
