import { badRequest, ok, serverError, unauthorized } from "@/lib/api-response";
import { createManualAnime, toPublicAnime } from "@/lib/anime-service";
import { getCurrentUser } from "@/lib/auth-session";

interface ManualBody {
  title?: string;
  titleCn?: string;
  titleJa?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  year?: number;
  season?: string;
  animeType?: string;
  tags?: string[];
  studios?: string[];
  summary?: string;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized("请先登录。");

  const body = (await request.json().catch(() => null)) as ManualBody | null;

  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return badRequest("title is required");
  }

  try {
    const anime = await createManualAnime({
      title: body.title,
      titleCn: body.titleCn,
      titleJa: body.titleJa,
      imageUrl: body.imageUrl,
      thumbnailUrl: body.thumbnailUrl,
      year: body.year,
      season: body.season,
      animeType: body.animeType,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      studios: Array.isArray(body.studios) ? body.studios : undefined,
      summary: body.summary,
    });

    return ok(toPublicAnime(anime), { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Manual anime creation failed");
  }
}
