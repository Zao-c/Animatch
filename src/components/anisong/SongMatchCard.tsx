"use client";
import { useState } from "react";
import { MatchCardFrame } from "@/components/MatchCardFrame";
import type { SongTrack } from "@/lib/anisong/types";
import { KIND_LABELS } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongPlayer, type PlaybackState } from "./SongPlayer";
import { SongPlayerPopover } from "./SongPlayerPopover";

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
    afterAction={<div className="flex min-h-9 items-center justify-center text-xs text-slate-300">
      <SongPlayerPopover label="歌曲详情">
        <div className="space-y-1 text-left">
          <p className="break-words font-semibold text-white">{track.title}</p>
          <p className="break-words text-cyan-100">{track.anime || (track.kind === "OTHER" ? "音乐曲目" : "所属动画未填写")}</p>
          <p className="break-words">{track.artist || "歌手未填写"} · {KIND_LABELS[track.kind]}</p>
          {(track.year || track.quarter) && <p className="text-slate-400">{track.year ?? "年份未知"} 年 · {track.quarter ? `第 ${track.quarter} 季度` : "季度未知"}</p>}
        </div>
      </SongPlayerPopover>
    </div>}
  >
    <div className="min-w-0 pb-2">
      <p className="line-clamp-2 min-h-8 break-words text-xs font-semibold leading-4 text-cyan-100 sm:text-sm" title={track.anime || "动画来源未填写"}>{track.anime || (track.kind === "OTHER" ? "音乐曲目" : "动画来源未填写")}</p>
      <p className="mt-1 truncate text-xs text-slate-400" title={track.artist}>{track.artist || "歌手未填写"} · {KIND_LABELS[track.kind]}</p>
    </div>
  </MatchCardFrame>;
}
