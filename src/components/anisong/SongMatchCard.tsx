"use client";
import { useState } from "react";
import { MatchCardFrame } from "@/components/MatchCardFrame";
import type { SongTrack } from "@/lib/anisong/types";
import { KIND_LABELS } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongPlayer, type PlaybackState } from "./SongPlayer";

export function SongMatchCard({ track, boardId, side, disabled, onPick }: {
  track: SongTrack; boardId: string; side: "left" | "right"; disabled: boolean; onPick: () => void; onUnheard?: () => void;
}) {
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  return <MatchCardFrame title={track.title} side={side} disabled={disabled} mode="music" playbackState={playback} highlighted={playback !== "idle"}
    onPick={onPick}
    mediaControls={<SongPlayer compact track={track} boardId={boardId} shortcut={side === "left" ? "q" : "e"} disabled={disabled} onPlaybackChange={setPlayback} />}
    artwork={<>
      <SongCover src={track.coverUrl} title={track.title} eager variant="hero" className="rounded-none border-0" />
      <span className="pointer-events-none absolute top-2 left-2 rounded-md border border-white/15 bg-slate-950/85 px-2 py-1 text-xs text-white backdrop-blur">{KIND_LABELS[track.kind]}</span>
      <span aria-live="polite" className="pointer-events-none absolute right-2 top-2 rounded-full border border-white/15 bg-slate-950/90 px-2 py-1 text-[10px] text-cyan-100 sm:text-xs">{playback === "loading" ? "加载中…" : playback === "playing" ? "♫ 正在试听" : side === "left" ? "左侧歌曲" : "右侧歌曲"}</span>
    </>}
    afterAction={<details className="relative text-xs text-slate-400"><summary className="flex min-h-9 cursor-pointer items-center justify-center">歌曲详情</summary><div className="absolute inset-x-0 top-full z-20 rounded-xl border border-white/15 bg-slate-950 p-3 text-sm leading-6 shadow-xl"><p className="mb-2 font-semibold text-slate-100">{track.title}</p><p>{track.artist || "歌手未填写"}</p><p className="text-slate-400">{track.anime || (track.kind === "OTHER" ? "音乐曲目" : "动画未填写")}</p></div></details>}
  />;
}
