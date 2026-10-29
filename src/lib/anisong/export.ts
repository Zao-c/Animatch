import { KIND_LABELS, type SongSnapshot } from "./types";
import { downloadSongFile } from "./client";

function loadCover(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    const finish = (value: HTMLImageElement | null) => {
      clearTimeout(timeout); image.onload = null; image.onerror = null;
      if (!value) image.src = "";
      resolve(value);
    };
    const timeout = setTimeout(() => finish(null), timeoutMs);
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => finish(image.naturalWidth ? image : null);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

export async function exportSongPng(snapshot: SongSnapshot) {
  await document.fonts.ready;
  const width = 1200, margin = 40, labelWidth = 110, cardWidth = 200, cardHeight = 258, coverSize = 176;
  const rows = snapshot.rows.filter(r => r.songs.length || ["s", "a", "b", "c", "d"].includes(r.id));
  const urls = [...new Set(rows.flatMap(r => r.songs.map(s => s.coverUrl).filter((url): url is string => Boolean(url))))];
  const covers = new Map<string, HTMLImageElement | null>();
  // Bound concurrent image requests and finish even when a remote host hangs.
  let cursor = 0;
  const deadline = Date.now() + 12000;
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      const remaining = deadline - Date.now();
      covers.set(url, remaining > 0 ? await loadCover(url, Math.min(8000, remaining)) : null);
    }
  }));
  const heights = rows.map(row => Math.max(100, Math.ceil(row.songs.length / 5) * cardHeight));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = 200 + heights.reduce((a, b) => a + b + 8, 0) + 70;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持图片导出");
  ctx.fillStyle = "#0b1223"; ctx.fillRect(0, 0, width, canvas.height);
  function text(value: string, x: number, y: number, max: number, size: number, color: string, bold = false) {
    ctx!.font = `${bold ? "700" : "400"} ${size}px system-ui, sans-serif`;
    ctx!.fillStyle = color;
    let result = value;
    if (ctx!.measureText(result).width > max) {
      const chars = Array.from(value);
      while (chars.length && ctx!.measureText(chars.join("") + "…").width > max) chars.pop();
      result = chars.join("") + "…";
    }
    ctx!.fillText(result, x, y);
  }
  text("ANISONGMATCH  /  AniMatch", margin, 52, 1100, 20, "#35e6dc", true);
  text(snapshot.title, margin, 111, 1100, 36, "#ffffff", true);
  text(`${snapshot.comparisons} 次有效对决 · 个人相对分档 · 手动调整以「手动」标注`, margin, 154, 1100, 18, "#94a3b8");
  let y = 190;
  rows.forEach((row, index) => {
    const height = heights[index];
    ctx.fillStyle = row.color; ctx.fillRect(margin, y, labelWidth, height);
    text(row.label, margin + 18, y + height / 2 + 10, labelWidth - 26, row.label.length > 2 ? 22 : 38, "#111827", true);
    ctx.fillStyle = "#172136"; ctx.fillRect(margin + labelWidth, y, width - margin * 2 - labelWidth, height);
    row.songs.forEach((song, i) => {
      const x = margin + labelWidth + 12 + (i % 5) * cardWidth;
      const sy = y + Math.floor(i / 5) * cardHeight + 12;
      const image = song.coverUrl ? covers.get(song.coverUrl) : null;
      if (image) {
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, x, sy, coverSize, coverSize);
      } else {
        ctx.fillStyle = "#22384c"; ctx.fillRect(x, sy, coverSize, coverSize);
        text("♪", x + 65, sy + 100, coverSize, 48, "#35e6dc");
      }
      text(song.title, x, sy + 201, coverSize, 19, "#f8fafc", true);
      text(song.artist || "歌手未填写", x, sy + 222, coverSize, 14, "#cbd5e1");
      text(`${KIND_LABELS[song.kind]}${song.anime ? ` · ${song.anime}` : ""}${song.manual ? " · 手动" : ""}`, x, sy + 241, coverSize, 12, "#94a3b8");
    });
    y += height + 8;
  });
  text("听一段，选一首。我的音乐偏好，由每一次选择组成。", margin, y + 40, 1100, 18, "#94a3b8");
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("导出失败")), "image/png"));
  downloadSongFile(`${snapshot.title.replace(/[\\/:*?"<>|]/g, "_")}-TierList.png`, blob);
  return { missingCovers: [...covers.values()].filter(value => value === null).length };
}
