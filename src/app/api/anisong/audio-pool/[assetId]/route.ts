import { prisma } from "@/lib/db";
import { fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { streamAudio } from "@/lib/anisong/audio-storage";
import { publicAudioDirectory } from "@/lib/anisong/shared/audio-pool";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const asset = await prisma.songAudioAsset.findUnique({ where: { id: params.assetId } });
    if (!asset) throw new AppError("公共音频不存在", 404);
    return await streamAudio(request, { kind: "upload", key: asset.key, mime: asset.mime, bytes: asset.bytes }, { directory: publicAudioDirectory(), public: true });
  } catch (error) { return fromError(error); }
}
export const HEAD = GET;
