import sharp from "sharp";
import { AppError } from "@/lib/app-error";
import { saveAnimeCoverUpload, deleteLocalAnimeCoverIfPresent } from "@/lib/anime-cover-upload";
import { MAX_SONG_COVER_BYTES, type SongDocument, type SongSnapshot } from "./types";

export async function saveSongCover(file: File, boardId: string, trackId: string) {
  if (!file.size || file.size > MAX_SONG_COVER_BYTES) throw new AppError("封面图片需在5 MB以内且不能为空", 400);
  let encoded: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20_000_000, animated: false });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "gif"].includes(metadata.format)) throw new Error("Unsupported image");
    encoded = await image.rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new AppError("封面无法读取，请上传有效的 JPG、PNG、WebP 或 GIF 图片", 400); }
  return saveAnimeCoverUpload({ file: new File([new Uint8Array(encoded)], "cover.webp", { type: "image/webp" }), poolId: `song-${boardId}`, animeId: trackId });
}

// Keep covers referenced by a published snapshot until that snapshot is updated or revoked.
export function songCoverReferences(document: SongDocument | null, snapshot: SongSnapshot | null) {
  return new Set([...(document?.tracks.map(t => t.coverUrl) ?? []), ...(snapshot?.rows.flatMap(r => r.songs.map(s => s.coverUrl)) ?? [])]
    .filter((url): url is string => typeof url === "string" && url.startsWith("/uploads/anime-covers/song-")));
}
export async function cleanSongCovers(previous: Set<string>, retained: Set<string>) {
  await Promise.all([...previous].filter(url => !retained.has(url)).map(url => deleteLocalAnimeCoverIfPresent(url)));
}
