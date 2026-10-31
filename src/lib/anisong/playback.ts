import type { SongAudioProvider, SongTrack } from "./types";
export type PlaybackPreferences = { preferred: "pool" | "itunes"; fallback: boolean };
export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = { preferred: "pool", fallback: true };
export const AUDIO_PROVIDER_LABELS: Record<SongAudioProvider, string> = { pool: "公共音频池", itunes: "iTunes", original: "原音源" };
export function songPlaybackPlan(track: SongTrack, options: PlaybackPreferences): SongAudioProvider[] {
  const local: SongAudioProvider | null = track.source.kind === "pool" ? "pool" : ["upload", "url", "netease"].includes(track.source.kind) ? "original" : null;
  const apple = Boolean(track.itunes || track.source.kind === "itunes");
  const preferred: SongAudioProvider | null = options.preferred === "itunes" ? apple ? "itunes" : null : local;
  const backup: SongAudioProvider | null = options.preferred === "itunes" ? local : apple ? "itunes" : null;
  return [preferred, ...(options.fallback ? [backup] : [])].filter((provider): provider is SongAudioProvider => provider !== null);
}
