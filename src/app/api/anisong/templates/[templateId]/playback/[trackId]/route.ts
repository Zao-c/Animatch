import { prisma } from "@/lib/db";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import type { SongDocument, SongAudioProvider } from "@/lib/anisong/types";
import { resolveSongPlayback } from "@/lib/anisong/shared/playback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only preview from an active public template; never resolve private uploads, URLs or NetEase. */
export async function GET(request: Request, { params }: { params: { templateId: string; trackId: string } }) {
  try {
    const template = await prisma.songTemplate.findFirst({
      where: { id: params.templateId, active: true }, select: { document: true }
    });
    if (!template) throw new AppError("公开曲单不存在或已下架", 404);
    const track = (template.document as unknown as SongDocument).tracks.find(item => item.id === params.trackId);
    if (!track) throw new AppError("歌曲不存在", 404);
    const choice = new URL(request.url).searchParams.get("provider") ?? (track.source.kind === "pool" ? "pool" : "itunes");
    if (choice !== "pool" && choice !== "itunes") throw new AppError("公开页面不支持私人音源", 400);
    if (choice === "pool" && track.source.kind !== "pool") throw new AppError("尚无可试听的公共音频", 422);
    if (choice === "itunes" && !track.itunes && track.source.kind !== "itunes") throw new AppError("尚无可试听的 iTunes 片段", 422);
    return ok(await resolveSongPlayback(track, "", "", choice as SongAudioProvider),
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fromError(error); }
}
