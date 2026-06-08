import { badRequest, ok, serverError } from "@/lib/api-response";
import { searchAndCacheAnime, toPublicAnime } from "@/lib/anime-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));

  if (!query) {
    return badRequest("q is required");
  }

  try {
    const items = await searchAndCacheAnime(query, limit);

    return ok({
      items: items.map(toPublicAnime)
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Anime search failed");
  }
}

function parseLimit(value: string | null): number {
  const parsed = value === null ? 20 : Number(value);

  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(30, Math.max(1, Math.trunc(parsed)));
}
