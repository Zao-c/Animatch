"use client";
import { useState } from "react";
import { MatchCardFrame } from "@/components/MatchCardFrame";
import type { SongTrack } from "@/lib/anisong/types";
import { KIND_LABELS } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongPlayer, type PlaybackState } from "./SongPlayer";

export function SongMatchCard({ track, boardId, side, disabled, onPick, onUnheard }: {
  track: SongTrack; boardId: string; side: "left" | "right"; disabled: boolean; onPick: () => void; onUnheard: () => void;
}) {
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  return <MatchCardFrame title={track.title} side={side} disabled={disabled} mode="music" playbackState={playback} highlighted={playback !== "idle"}
    onPick={onPick} heroClassName="!h-[clamp(12rem,35dvh,25rem)] sm:!h-[clamp(20rem,48dvh,35rem)]"
    artwork={<>
      <SongCover src={track.coverUrl} title={track.title} eager variant="hero" className="rounded-none border-0" />
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-white/15 bg-slate-950/85 px-2 py-1 text-xs text-white backdrop-blur">{KIND_LABELS[track.kind]}</span>
      <span aria-live="polite" className="pointer-events-none absolute right-2 top-2 rounded-full border border-white/15 bg-slate-950/90 px-2 py-1 text-[10px] text-cyan-100 sm:text-xs">{playback === "loading" ? "加载中…" : playback === "playing" ? "♫ 正在试听" : side === "left" ? "左侧歌曲" : "右侧歌曲"}</span>
    </>}
    afterAction={<button type="button" disabled={disabled} onClick={onUnheard} className="min-h-10 text-xs text-slate-400 transition hover:text-white disabled:opacity-40">这首没听过</button>}
  >
    <div className="min-w-0 space-y-1 pb-2">
      <p title={track.artist} className="truncate text-xs text-slate-300">{track.artist || "歌手未填写"}</p>
      <p title={track.anime} className="truncate text-xs text-slate-500">{track.anime || (track.kind === "OTHER" ? "音乐曲目" : "动画未填写")}</p>
    </div>
    <div className="mb-3"><SongPlayer track={track} boardId={boardId} shortcut={side === "left" ? "q" : "e"} disabled={disabled} onPlaybackChange={setPlayback} /></div>
  </MatchCardFrame>;
}
