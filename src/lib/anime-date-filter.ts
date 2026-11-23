import type { Prisma } from "@prisma/client";

/** Use airDate for historical records whose separate year field is missing. */
export function animeYearFilter(from?: number | null, to?: number | null): Prisma.AnimeWhereInput | null {
  if (from == null && to == null) return null;
  const year = { ...(from != null ? { gte: from } : {}), ...(to != null ? { lte: to } : {}) };
  const airDate = {
    ...(from != null ? { gte: new Date(Date.UTC(from, 0, 1)) } : {}),
    ...(to != null ? { lt: new Date(Date.UTC(to + 1, 0, 1)) } : {})
  };
  return { OR: [{ year }, { year: null, airDate }] };
}
