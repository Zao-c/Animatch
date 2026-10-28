"use client";
import { useEffect, useRef, useState } from "react";
import type { SongTrack } from "@/lib/anisong/types";

// The custom event is scoped to AnisongMatch players, including library auditions.
const PLAY_EVENT = "anisong:play";
export function SongPlayer({ track, boardId }: { track: SongTrack; boardId: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const src = track.source.kind === "upload" ? `/api/anisong/boards/${boardId}/audio/${track.id}` : track.source.kind === "url" ? track.source.url : "";
  const end = Math.min(track.clipStart + track.clipLength, duration ?? Infinity);
  useEffect(() => {
    const element = audio.current;
    function stop(event: Event) { if ((event as CustomEvent).detail !== element) element?.pause(); }
    window.addEventListener(PLAY_EVENT, stop);
    return () => { window.removeEventListener(PLAY_EVENT, stop); element?.pause(); };
  }, []);
  async function toggle() {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) { element.pause(); return; }
    setError("");
    if (duration !== null && track.clipStart >= duration) { setError("试听起点超出了音频长度，请编辑歌曲调整起点。"); return; }
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: element }));
    try {
      if (element.readyState === 0) {
        // Metadata is loaded on user interaction. onLoadedMetadata applies the clip offset.
        element.load();
      } else if (element.currentTime < track.clipStart || element.currentTime >= end - 0.1) element.currentTime = track.clipStart;
      await element.play();
    } catch { setError("暂时无法播放，请重试或检查音频格式、直链是否有效。"); setPlaying(false); }
  }
  if (!src) return <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">尚未添加音频 · 可以凭印象选择，或在曲单中补充。</p>;
  return <div className="space-y-3">
    <audio ref={audio} src={src} preload="none"
      onLoadedMetadata={e => { const a = e.currentTarget; setDuration(Number.isFinite(a.duration) ? a.duration : null); if (track.clipStart >= a.duration) { a.pause(); setError("试听起点超出了音频长度，请编辑歌曲调整起点。"); } else { a.currentTime = track.clipStart; } }}
      onPlay={e => { window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: e.currentTarget })); setPlaying(true); }}
      onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { setError("音频无法加载，请检查文件或直链。仍可凭印象选择或跳过。"); setPlaying(false); }}
      onTimeUpdate={e => { const a = e.currentTarget; setElapsed(Math.max(0, a.currentTime - track.clipStart)); if (a.currentTime >= end) a.pause(); }} />
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => void toggle()} aria-label={`${playing ? "暂停" : "试听"} ${track.title}`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-anime-cyan/40 bg-anime-cyan/10 text-lg text-anime-cyan">{playing ? "Ⅱ" : "▶"}</button>
      <label className="min-w-0 flex-1 text-xs text-slate-400"><span className="flex justify-between"><span>{playing ? "正在试听" : "试听片段"}</span><span>{Math.floor(elapsed)} / {Math.max(0, Math.round(end - track.clipStart))}s</span></span>
        <input aria-label={`${track.title} 试听进度`} className="mt-2 h-2 w-full accent-teal-300" type="range" min={0} max={Math.max(0, end - track.clipStart)} step={0.1} value={Math.min(elapsed, Math.max(0, end - track.clipStart))} disabled={duration === null}
          onChange={e => { if (audio.current) { audio.current.currentTime = track.clipStart + Number(e.target.value); setElapsed(Number(e.target.value)); } }} />
      </label>
    </div>
    {error && <p role="alert" className="text-xs leading-5 text-amber-200">{error}</p>}
  </div>;
}
