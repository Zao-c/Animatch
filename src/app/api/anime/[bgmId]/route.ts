import { badRequest, notFound, ok, serverError } from "@/lib/api-response";
import { getOrImportAnimeByBgmId, toPublicAnime } from "@/lib/anime-service";

interface RouteContext {
  params: {
    bgmId: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const bgmId = Number(context.params.bgmId);

  if (!Number.isSafeInteger(bgmId) || bgmId <= 0) {
    return badRequest("bgmId must be a positive integer");
  }

  try {
    const anime = await getOrImportAnimeByBgmId(bgmId);

    if (anime === null) {
      return notFound("Anime not found");
    }

    return ok(toPublicAnime(anime));
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Anime lookup failed");
  }
}
