import { prisma } from "@/lib/db";
import { fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { streamAudio } from "@/lib/anisong/audio-storage";
import { publicAudioDirectory } from "@/lib/anisong/shared/audio-pool";
import { cosAudioPublicUrl, isCosAudioConfigured } from "@/lib/anisong/shared/cos-audio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const asset = await prisma.songAudioAsset.findUnique({ where: { id: params.assetId } });
    if (!asset) throw new AppError("公共音频不存在", 404);
    const key = asset.previewKey || asset.key;
    if (asset.storageProvider === "cos") {
      if (!isCosAudioConfigured()) throw new AppError("公共音频不存在", 404);
      return Response.redirect(cosAudioPublicUrl(key), 307);
    }
    return await streamAudio(request, { kind: "upload", key, mime: asset.previewMime || asset.mime, bytes: asset.previewBytes || asset.bytes }, { directory: publicAudioDirectory(), public: true });
  } catch (error) { return fromError(error); }
}
export const HEAD = GET;
