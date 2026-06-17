import { ok, badRequest, fromError } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { previewQuickImportWithRemoteFallback, type QuickImportParams } from "@/lib/import/quick-pool-builder";

interface PreviewBody {
  params?: QuickImportParams;
  poolId?: string;
  useRemote?: boolean;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PreviewBody | null;
  const params = body?.params;
  const useRemote = body?.useRemote !== false;

  if (!params || !params.source || !params.mode) {
    return badRequest("source 和 mode 是必填字段");
  }

  const validSources = ["BANGUMI", "MANAMI", "MIXED"];
  const validModes = ["YEAR", "TAG", "TOP", "USER_COLLECTION"];
  if (!validSources.includes(params.source)) {
    return badRequest(`source 必须是 ${validSources.join("/")} 之一`);
  }
  if (!validModes.includes(params.mode)) {
    return badRequest(`mode 必须是 ${validModes.join("/")} 之一`);
  }

  try {
    await requireCurrentUser();

    let poolAnimeIds: Set<string> | undefined;
    if (body?.poolId) {
      const { prisma } = await import("@/lib/db");
      const entries = await prisma.poolAnime.findMany({
        where: { poolId: body.poolId },
        select: { animeId: true },
      });
      poolAnimeIds = new Set(entries.map((e) => e.animeId));
    }

    const result = await previewQuickImportWithRemoteFallback(params, poolAnimeIds, useRemote);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
