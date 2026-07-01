import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { getMatchQueue } from "@/lib/match-service";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { prewarmCoverCacheBackground } from "@/lib/server/cover-cache-prewarm";
import type { PublicAnime } from "@/lib/anime-service";

interface MatchQueueResult {
  pairs?: Array<{
    left?: { anime?: PublicAnime; display?: { coverUrl?: string | null } };
    right?: { anime?: PublicAnime; display?: { coverUrl?: string | null } };
  }>;
}

function prewarmMatchQueue(queue: MatchQueueResult): void {
  const animes = new Map<string, PublicAnime>();
  for (const pair of queue.pairs ?? []) {
    for (const side of [pair.left, pair.right]) {
      const anime = side?.anime;
      if (anime && !animes.has(anime.id)) {
        animes.set(anime.id, anime);
      }
    }
  }
  const urls = [...animes.values()].flatMap((anime) => {
    const primary = getAnimeCoverUrl(anime, { intent: "display" });
    const secondary = getAnimeCoverUrl(anime, { intent: "export" });
    return [primary, secondary];
  });
  prewarmCoverCacheBackground(urls, { limit: 10, concurrency: 3 });
}

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));

  try {
    const user = await requireCurrentUser();
    const queue = await getMatchQueue({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      limit
    });

    prewarmMatchQueue(queue);

    return ok(queue);
  } catch (error) {
    return fromError(error);
  }
}

function parseLimit(value: string | null): number {
  const parsed = value === null ? 8 : Number(value);

  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(10, Math.max(1, Math.trunc(parsed)));
}
