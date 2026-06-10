import { badRequest, ok, serverError } from "@/lib/api-response";
import { searchLocalAnime, toPublicAnime } from "@/lib/anime-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));
  const offset = parseOffset(url.searchParams.get("offset"));

  if (!query) {
    return badRequest("q is required");
  }

  try {
    const items = await searchLocalAnime(query, limit, { offset });

    if (items.length === 0) {
      return ok({
        items: [],
        message: "本地动画库暂无匹配结果。你可以尝试手动添加，或导入更多离线数据。",
      });
    }

    return ok({
      items: items.map(toPublicAnime),
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Anime search failed");
  }
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
