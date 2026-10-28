"use client";
import { useEffect, useRef, useState } from "react";
import type { SongTrack } from "@/lib/anisong/types";

const PLAY_EVENT = "anisong:play";
export function SongPlayer({ track, boardId }: { track: SongTrack; boardId: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const wanted = useRef(false);
  const generation = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.8);
  const src = track.source.kind === "upload" ? `/api/anisong/boards/${boardId}/audio/${track.id}` : track.source.kind === "url" ? track.source.url : "";
  const end = Math.min(track.clipStart + track.clipLength, duration ?? Infinity);
  const length = Math.max(0, end - track.clipStart);
  useEffect(() => {
    const element = audio.current;
    const playbackGeneration = generation;
    let savedVolume = 0.8;
    try {
      const saved = localStorage.getItem("anisong.volume");
      if (saved !== null && Number.isFinite(Number(saved))) savedVolume = Math.min(1, Math.max(0, Number(saved)));
    } catch { /* Playback still works when browser storage is unavailable. */ }
    if (element) element.volume = savedVolume;
    setVolume(savedVolume);
    function volumeChanged(event: Event) {
      const value = (event as CustomEvent<number>).detail;
      if (!Number.isFinite(value) || value < 0 || value > 1) return;
      if (element) element.volume = value;
      setVolume(value);
    }
    function stop(event: Event) {
      if ((event as CustomEvent).detail === element) return;
      wanted.current = false; generation.current++; element?.pause(); setLoading(false);
    }
    window.addEventListener(PLAY_EVENT, stop);
    window.addEventListener("anisong:volume", volumeChanged);
    return () => { wanted.current = false; playbackGeneration.current++; window.removeEventListener(PLAY_EVENT, stop); window.removeEventListener("anisong:volume", volumeChanged); element?.pause(); };
  }, []);
  async function toggle() {
    const element = audio.current;
    if (!element) return;
    if (wanted.current) { wanted.current = false; generation.current++; element.pause(); setLoading(false); return; }
    setError("");
    if (duration !== null && track.clipStart >= duration) { setError("试听起点超出音频长度，请编辑歌曲调整起点。"); return; }
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: element }));
    wanted.current = true;
    const current = ++generation.current;
    setLoading(true);
    try {
      if (element.readyState === 0 || element.error) element.load();
      else if (element.currentTime < track.clipStart || element.currentTime >= end - 0.1) element.currentTime = track.clipStart;
      await element.play();
    } catch (e) {
      if (generation.current === current && wanted.current) {
        wanted.current = false;
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("暂时无法播放，请重试或更换音频。");
        setPlaying(false);
      }
    } finally { if (generation.current === current) setLoading(false); }
  }
  if (!src) return <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs leading-5 text-slate-400">尚未添加音频，可凭印象选择或在曲单中补充。</p>;
  return <div className="space-y-2">
    <audio ref={audio} src={src} preload="none"
      onLoadedMetadata={e => { const a = e.currentTarget; setDuration(Number.isFinite(a.duration) ? a.duration : null); if (track.clipStart >= a.duration) { wanted.current = false; a.pause(); setLoading(false); setError("试听起点超出音频长度，请编辑歌曲调整起点。"); } else a.currentTime = track.clipStart; }}
      onPlay={e => { if (!wanted.current) { e.currentTarget.pause(); return; } window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: e.currentTarget })); setPlaying(true); }}
      onPlaying={() => setLoading(false)} onWaiting={() => { if (wanted.current) setLoading(true); }}
      onPause={() => setPlaying(false)} onEnded={() => { wanted.current = false; setPlaying(false); }}
      onError={() => { if (wanted.current) setError("音频无法加载，请检查文件或直链。可以跳过这组。"); wanted.current = false; setLoading(false); setPlaying(false); }}
      onTimeUpdate={e => { const a = e.currentTarget; setElapsed(Math.min(length, Math.max(0, a.currentTime - track.clipStart))); if (a.currentTime >= end) { wanted.current = false; a.pause(); } }} />
    <div className="flex items-center gap-2 sm:gap-3">
      <button type="button" onClick={() => void toggle()} aria-label={`${playing || loading ? "暂停" : "试听"} ${track.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-anime-cyan/40 bg-anime-cyan/10 text-lg text-anime-cyan">{loading ? "…" : playing ? "Ⅱ" : "▶"}</button>
      <label className="min-w-0 flex-1 text-[10px] text-slate-400 sm:text-xs"><span className="flex flex-wrap justify-between gap-x-1"><span>{loading ? "正在加载" : playing ? "正在试听" : "试听片段"}</span><span>{Math.floor(elapsed)} / {Math.round(length)}s</span></span>
        <input aria-label={`${track.title} 试听进度`} className="mt-2 h-2 w-full accent-teal-300" type="range" min={0} max={length} step={0.1} value={Math.min(elapsed, length)} disabled={duration === null}
          onChange={e => { if (audio.current) { audio.current.currentTime = track.clipStart + Number(e.target.value); setElapsed(Number(e.target.value)); } }} />
      </label>
    </div>
    <details className="text-xs text-slate-400"><summary className="cursor-pointer py-1">音量</summary><input aria-label={`${track.title} 音量`} type="range" min={0} max={1} step={0.05} value={volume} className="h-8 w-full accent-teal-300" onChange={e => { const v = Number(e.target.value); window.dispatchEvent(new CustomEvent("anisong:volume", { detail: v })); try { localStorage.setItem("anisong.volume", String(v)); } catch { /* Optional preference storage. */ } }} /></details>
    {error && <p role="alert" className="text-xs leading-5 text-amber-200">{error}</p>}
  </div>;
}
