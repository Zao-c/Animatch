/** Only rewrite known iTunes artwork dimensions, never arbitrary user cover URLs. */
function resizedAppleCover(src: string, size: 100 | 600): string {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || !/(^|\.)mzstatic\.com$/i.test(url.hostname) || url.username || url.password || url.port) return src;
    const match = url.pathname.match(/\/(\d{2,4})x(\d{2,4})bb(-\d+)?\.(jpe?g|png|webp)$/i);
    if (!match) return src;
    url.pathname = url.pathname.replace(/\/\d{2,4}x\d{2,4}bb(-\d+)?\.(jpe?g|png|webp)$/i, "/" + size + "x" + size + "bb" + (match[3] ?? "") + "." + match[4]);
    return url.href;
  } catch {
    return src;
  }
}

/** Higher-resolution request, not a guarantee the CDN can provide more detail. */
export function preferredSongCover(src: string | null | undefined): string | null {
  return src ? resizedAppleCover(src, 600) : null;
}
export function songCoverCandidates(src: string | null | undefined): string[] {
  if (!src) return [];
  return [...new Set([resizedAppleCover(src, 600), src, resizedAppleCover(src, 100)])];
}
