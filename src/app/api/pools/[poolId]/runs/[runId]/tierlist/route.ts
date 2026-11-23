import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { getRunTierList } from "@/lib/tier-service";
import { prewarmCoverCacheBackground } from "@/lib/server/cover-cache-prewarm";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import type { PublicAnime } from "@/lib/anime-service";

function prewarmTierList(tierList: {
  tiers?: Record<string, Array<{
    anime?: PublicAnime;
    display?: { coverUrl?: string | null };
  }>>;
}): void {
  const animes = new Map<string, PublicAnime>();
  for (const items of Object.values(tierList.tiers ?? {})) {
    for (const item of items) {
      const anime = item.anime;
      if (anime && !animes.has(anime.id)) {
        animes.set(anime.id, anime);
      }
    }
  }
  const urls = [...animes.values()].slice(0, 30).flatMap((anime) => {
    const primary = getAnimeCoverUrl(anime, { intent: "display" });
    const secondary = getAnimeCoverUrl(anime, { intent: "export" });
    return [primary, secondary];
  });
  prewarmCoverCacheBackground(urls, { limit: 60, concurrency: 3 });
}

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const tierList = await getRunTierList({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId
    });

    prewarmTierList(tierList);

    return ok(tierList);
  } catch (error) {
    return fromError(error);
  }
}
