import { NextRequest } from "next/server";
import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { getSeasonMatchQueue } from "@/lib/season-service";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { prewarmCoverCacheBackground } from "@/lib/server/cover-cache-prewarm";

export async function GET(
  request: NextRequest,
  { params }: { params: { poolId: string; seasonId: string } }
) {
  try {
    const user = await requireCurrentUser();
    const { searchParams } = new URL(request.url);
    const queue = await getSeasonMatchQueue(params.poolId, params.seasonId, user.id, {
      limit: parsePositiveInt(searchParams.get("limit")),
      excludePairKeys: parseCsv(searchParams.get("excludePairKeys")),
      hiddenAnimeIds: parseCsv(searchParams.get("hiddenAnimeIds"))
    });
    prewarmSeasonQueue(queue);
    return ok(queue);
  } catch (error) {
    return fromError(error);
  }
}

function parsePositiveInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseCsv(value: string | null): string[] {
  if (value === null || value.trim() === "") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function prewarmSeasonQueue(queue: Array<{ left?: { imageUrl?: string | null; imageLargeUrl?: string | null; imageMediumUrl?: string | null; imageSmallUrl?: string | null; thumbnailUrl?: string | null }; right?: { imageUrl?: string | null; imageLargeUrl?: string | null; imageMediumUrl?: string | null; imageSmallUrl?: string | null; thumbnailUrl?: string | null } }>): void {
  const urls: string[] = [];
  for (const pair of queue) {
    for (const side of [pair.left, pair.right]) {
      if (!side) continue;
      const url = getAnimeCoverUrl(side as Parameters<typeof getAnimeCoverUrl>[0], { intent: "display" });
      if (url) urls.push(url);
    }
  }
  prewarmCoverCacheBackground(urls, { limit: 20, concurrency: 3 });
}
