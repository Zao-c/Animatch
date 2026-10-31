import { parseBlob } from "music-metadata";
import { cleanSongTag, riffSongTag, embeddedCover, filenameMetadata, type LocalSongMetadata } from "./metadata";

self.onmessage = async (event: MessageEvent<File>) => {
  const file = event.data;
  const fallback = filenameMetadata(file.name);
  let result: LocalSongMetadata = { ...fallback, cover: null, note: "无法读取标签，已按文件名填写" };
  try {
    const { common, format } = await parseBlob(file, { duration: false });
    const tag = format.container === "WAVE" ? riffSongTag : cleanSongTag;
    const title = tag(common.title);
    const artist = tag(common.artist);
    let cover = embeddedCover(common.picture);
    let coverFailed = Boolean(common.picture?.length) && !cover;
    if (cover) {
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(cover);
        if (bitmap.width * bitmap.height > 20_000_000) throw new Error("Cover too large");
        const ratio = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
        const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * ratio)), Math.max(1, Math.round(bitmap.height * ratio)));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        cover = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
      } catch { cover = null; coverFailed = true; }
      finally { bitmap?.close(); }
    }
    result = { title: title || fallback.title, artist: artist || fallback.artist, cover,
      note: [title || artist ? "已读取文件标签" : "无歌名标签，已按文件名填写", cover ? "已读取内嵌封面" : coverFailed ? "内嵌封面无法使用，可手动上传" : "无内嵌封面，可手动上传"].join(" · ") };
  } catch { /* An unreadable tag must never prevent manual import. */ }
  self.postMessage(result);
};
