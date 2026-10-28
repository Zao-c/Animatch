import type { SongSnapshot } from "./types";
import { downloadSongFile } from "./client";

// Draw text directly so exports do not depend on remote covers or cross-origin audio.
export async function exportSongPng(snapshot: SongSnapshot) {
  await document.fonts.ready;
  const width = 1200, margin = 40, labelWidth = 110, cardWidth = 320, cardHeight = 108;
  const rows = snapshot.rows.filter(r => r.songs.length || ["s", "a", "b", "c", "d"].includes(r.id));
  const heights = rows.map(row => Math.max(100, Math.ceil(row.songs.length / 3) * cardHeight));
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
      const x = margin + labelWidth + 18 + (i % 3) * cardWidth;
      const sy = y + Math.floor(i / 3) * cardHeight;
      text(song.title, x, sy + 32, cardWidth - 22, 23, "#f8fafc", true);
      text(song.artist || "歌手未填写", x, sy + 58, cardWidth - 22, 16, "#cbd5e1");
      text(`${song.kind} · ${song.anime || "动画未填写"}${song.manual ? " · 手动" : ""}`, x, sy + 83, cardWidth - 22, 14, "#94a3b8");
    });
    y += height + 8;
  });
  text("听一段，选一首。我的音乐偏好，由每一次选择组成。", margin, y + 40, 1100, 18, "#94a3b8");
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("导出失败")), "image/png"));
  downloadSongFile(`${snapshot.title.replace(/[\\/:*?"<>|]/g, "_")}-TierList.png`, blob);
}
