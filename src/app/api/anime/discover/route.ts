import { ok, serverError } from "@/lib/api-response";
import { toPublicAnime } from "@/lib/anime-service";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const tag = url.searchParams.get("tag")?.trim() ?? "";
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
        not: "CUSTOM_UPLOAD"
      }
    };

    if (query) {
      const terms = query.split(/\s+/).filter(Boolean).map((t) => t.toLowerCase());
      if (terms.length > 0) {
        where.AND = terms.map((term) => ({
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { titleCn: { contains: term, mode: "insensitive" } },
            { titleJa: { contains: term, mode: "insensitive" } },
            { titleEn: { contains: term, mode: "insensitive" } },
            { aliases: { hasSome: [term] } },
            { tags: { hasSome: [term] } },
            { studios: { hasSome: [term] } },
          ],
        }));
      }
    }

    if (tag) {
      where.tags = { has: tag.toLowerCase() };
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
