import type { SongTrack } from "./types";

let media: HTMLAudioElement[] = [];

export function cancelSongAudioPreload() {
  for (const element of media) {
    element.pause();
    element.removeAttribute("src");
    element.load();
  }
  media = [];
}

function shouldSkipForNetwork() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return connection?.saveData === true || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g";
}

/** Warm metadata for only the next public-pool pair; never prefetch private or third-party audio. */
export function preloadSongAudioPair(tracks: SongTrack[]) {
  cancelSongAudioPreload();
  if (typeof window === "undefined" || typeof Audio === "undefined" || shouldSkipForNetwork()) return;
  const candidates = tracks.filter(track => track.source.kind === "pool").slice(0, 2);
  if (!candidates.length) return;
  for (const track of candidates) {
    if (track.source.kind !== "pool") continue;
    const element = new Audio();
    element.preload = "metadata";
    element.src = new URL(`/api/anisong/audio-pool/${encodeURIComponent(track.source.assetId)}`, window.location.origin).href;
    media.push(element);
    element.load();
  }
}
