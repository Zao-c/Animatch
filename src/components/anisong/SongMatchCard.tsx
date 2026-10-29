"use client";
import { useState } from "react";
import type { SongTrack } from "@/lib/anisong/types";
import { KIND_LABELS } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongPlayer, type PlaybackState } from "./SongPlayer";

export function SongMatchCard({ track, boardId, side, disabled, onPick, onUnheard }: {
  track: SongTrack; boardId: string; side: "left" | "right"; disabled: boolean; onPick: () => void; onUnheard: () => void;
}) {
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  return <article aria-busy={disabled} data-playback={playback} className={`flex min-w-0 flex-col rounded-2xl border bg-slate-950/35 p-1.5 transition-colors sm:p-2 ${playback !== "idle" ? "border-anime-cyan/60 ring-1 ring-anime-cyan/20" : "border-white/10"}`}>
    <div className="relative">
      <SongCover src={track.coverUrl} title={track.title} eager className="w-full" />
      <span className="absolute bottom-2 left-2 rounded-md border border-white/15 bg-slate-950/80 px-2 py-1 text-xs text-white backdrop-blur">{KIND_LABELS[track.kind]}</span>
      <span aria-live="polite" className="pointer-events-none absolute right-2 top-2 rounded-full border border-white/15 bg-slate-950/85 px-2 py-1 text-[10px] text-cyan-100 backdrop-blur sm:text-xs">{playback === "loading" ? "加载中…" : playback === "playing" ? "♫ 正在试听" : `${side === "left" ? "左" : "右"}侧歌曲`}</span>
      <button type="button" disabled={disabled} onClick={onPick} aria-label={`选择${side === "left" ? "左边" : "右边"}：${track.title}`} className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-wait" />
    </div>
    <div className="flex flex-1 flex-col p-1.5 sm:p-2">
      <h3 title={track.title} className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-100 sm:text-base">{track.title}</h3>
      <p title={track.artist} className="mt-1 truncate text-xs text-slate-300">{track.artist || "歌手未填写"}</p>
      <p title={track.anime} className="mt-1 truncate text-xs text-slate-500">{track.anime || (track.kind === "OTHER" ? "音乐曲目" : "动画未填写")}</p>
      <div className="my-3"><SongPlayer track={track} boardId={boardId} shortcut={side === "left" ? "q" : "e"} disabled={disabled} onPlaybackChange={setPlayback} /></div>
      <button type="button" onClick={onPick} disabled={disabled} className="mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-anime-cyan px-2 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50"><kbd className="hidden text-xs sm:inline" aria-hidden>{side === "left" ? "←" : "→"}</kbd>{side === "left" ? "更喜欢左边" : "更喜欢右边"}</button>
      <button type="button" disabled={disabled} onClick={onUnheard} className="min-h-10 text-xs text-slate-400 hover:text-white disabled:opacity-40">这首没听过</button>
    </div>
  </article>;
}
