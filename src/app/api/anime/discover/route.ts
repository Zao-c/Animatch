import { ok, serverError } from "@/lib/api-response";
import { GLOBAL_SEARCH_EXCLUDED_SOURCES, toPublicAnime } from "@/lib/anime-service";
import { expandTagQuery, matchTagAliases, normalizeTagKey } from "@/lib/anime-tag-dictionary";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const selectedTags = parseSelectedTags(url);
  const studio = url.searchParams.get("studio")?.trim() ?? "";
  const yearFrom = parseOptionalInt(url.searchParams.get("yearFrom"));
  const yearTo = parseOptionalInt(url.searchParams.get("yearTo"));
  const type = url.searchParams.get("type")?.trim() ?? "";
  const sort = url.searchParams.get("sort")?.trim() ?? "title";
  const limit = parseLimit(url.searchParams.get("limit"));
  const offset = parseOffset(url.searchParams.get("offset"));

  try {
    const where: Prisma.AnimeWhereInput = {
      source: {
        notIn: GLOBAL_SEARCH_EXCLUDED_SOURCES
      }
    };
    const andConditions: Prisma.AnimeWhereInput[] = [];

    if (query) {
      const terms = query.split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        andConditions.push(
          ...terms.map((term) => {
            const variants = expandDiscoverQueryTerm(term);
            const orConditions: Prisma.AnimeWhereInput[] = variants.flatMap((variant) => [
              { title: { contains: variant, mode: "insensitive" } },
              { titleCn: { contains: variant, mode: "insensitive" } },
              { titleJa: { contains: variant, mode: "insensitive" } },
              { titleEn: { contains: variant, mode: "insensitive" } },
              { aliases: { has: variant } },
              { tags: { has: variant } },
              { studios: { has: variant } },
            ]);

            return {
              OR: orConditions,
            };
          })
        );
      }
    }

    if (selectedTags.length > 0) {
      andConditions.push(...selectedTags.map((tag) => ({ tags: { has: tag } })));
    }

    if (studio) {
      where.studios = { has: studio.toLowerCase() };
    }

    if (yearFrom !== null || yearTo !== null) {
      where.year = {};
      if (yearFrom !== null) where.year.gte = yearFrom;
      if (yearTo !== null) where.year.lte = yearTo;
    }

    if (type) {
      where.animeType = type.toUpperCase();
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const orderBy: Prisma.AnimeOrderByWithRelationInput =
      sort === "year" ? { year: "desc" }
      : sort === "score" ? { bangumiScore: "desc" }
      : { title: "asc" };

    const [items, total] = await Promise.all([
      prisma.anime.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.anime.count({ where }),
    ]);

    return ok({
      items: items.map(toPublicAnime),
      total,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Discover failed");
  }
}

function parseSelectedTags(url: URL): string[] {
  const values = [
    url.searchParams.get("tag") ?? "",
    ...url.searchParams
      .getAll("tags")
      .flatMap((value) => value.split(",")),
  ];

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => matchTagAliases(value) ?? normalizeTagKey(value))
        .filter(Boolean)
    )
  );
}

function expandDiscoverQueryTerm(term: string): string[] {
  return Array.from(new Set([term.trim(), normalizeTagKey(term), ...expandTagQuery(term)].filter(Boolean)));
}

function parseOptionalInt(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isSafeInteger(parsed) ? parsed : null;
}

function parseLimit(value: string | null): number {
  const parsed = value === null ? 20 : Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(50, Math.max(1, Math.trunc(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = value === null ? 0 : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}
