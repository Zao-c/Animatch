"use client";
import { useEffect, useRef, useState } from "react";
import type { SongTrack } from "@/lib/anisong/types";
import { songRequest } from "@/lib/anisong/client";
import type { NeteasePlayback } from "@/lib/anisong/netease/types";

const PLAY_EVENT = "anisong:play";
const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export type PlaybackState = "idle" | "loading" | "playing";
export function SongPlayer({ track, boardId, shortcut, disabled = false, onPlaybackChange }: { track: SongTrack; boardId: string; shortcut?: "q" | "e"; disabled?: boolean; onPlaybackChange?: (state: PlaybackState) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const wanted = useRef(false);
  const generation = useRef(0);
  const resolution = useRef<AbortController | null>(null);
  const resolved = useRef<NeteasePlayback | null>(null);
  const [trial, setTrial] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.8);
  const src = track.source.kind === "upload" ? `/api/anisong/boards/${boardId}/audio/${track.id}` : track.source.kind === "url" ? track.source.url : "";
  const remote = track.source.kind === "netease";
  const end = Math.min(track.clipStart + track.clipLength, duration ?? Infinity);
  const length = Math.max(0, end - track.clipStart);
  useEffect(() => { onPlaybackChange?.(loading ? "loading" : playing ? "playing" : "idle"); }, [playing, loading, onPlaybackChange]);
  useEffect(() => {
    if (!shortcut || (!src && !remote)) return;
    function keyboard(event: KeyboardEvent) {
      if (disabled || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.key.toLowerCase() !== shortcut) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable=false])")) return;
      event.preventDefault(); void toggle();
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  });
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
      wanted.current = false; generation.current++; resolution.current?.abort(); element?.pause(); setLoading(false);
    }
    function accountChanged() { if (remote) { stop(new CustomEvent(PLAY_EVENT, { detail: null })); resolved.current = null; setTrial(false); } }
    window.addEventListener(PLAY_EVENT, stop);
    window.addEventListener("anisong:volume", volumeChanged);
    window.addEventListener("anisong:netease-account", accountChanged);
    return () => { wanted.current = false; playbackGeneration.current++; resolution.current?.abort(); window.removeEventListener(PLAY_EVENT, stop); window.removeEventListener("anisong:volume", volumeChanged); window.removeEventListener("anisong:netease-account", accountChanged); element?.pause(); };
  }, [remote]);
  async function toggle(restart = false) {
    const element = audio.current;
    if (!element) return;
    if (wanted.current && !restart) { wanted.current = false; generation.current++; resolution.current?.abort(); element.pause(); setLoading(false); return; }
    setError("");
    if (!remote && duration !== null && track.clipStart >= duration) { setError("试听起点超出音频长度，请编辑歌曲调整起点。"); return; }
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: element }));
    wanted.current = true;
    const current = ++generation.current;
    setLoading(true);
    try {
      if (remote && (!resolved.current || resolved.current.expiresAt <= Date.now() + 5000 || element.error)) {
        const controller = new AbortController(); resolution.current = controller;
        const playback = await songRequest<NeteasePlayback>(`/api/anisong/boards/${boardId}/playback/${track.id}`, { signal: controller.signal });
        if (generation.current !== current || !wanted.current) return;
        resolved.current = playback; setTrial(playback.trial); setDuration(null); setElapsed(0);
        element.src = playback.url; element.load();
      }
      if (generation.current !== current || !wanted.current) return;
      if (element.readyState === 0 || element.error) element.load();
      else if (restart || element.currentTime < track.clipStart || element.currentTime >= end - 0.1) element.currentTime = track.clipStart;
      if (restart) setElapsed(0);
      await element.play();
    } catch (e) {
      if (generation.current === current && wanted.current) {
        wanted.current = false;
        if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof DOMException ? "浏览器未能播放，请再次点击试听或更换音频。" : e instanceof Error ? e.message : "暂时无法播放，请重试或更换音频。");
        setPlaying(false);
      }
    } finally { if (generation.current === current) setLoading(false); }
  }
  if (!src && !remote) return <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs leading-5 text-slate-400">尚未添加音频，可凭印象选择或在曲单中补充。</p>;
  return <div className={`space-y-2 rounded-xl border p-2 transition-colors sm:p-3 ${playing || loading ? "border-anime-cyan/30 bg-anime-cyan/5" : "border-white/10 bg-slate-950/30"}`}>
    <audio ref={audio} src={src || undefined} preload="none"
      onLoadedMetadata={e => { const a = e.currentTarget; setDuration(Number.isFinite(a.duration) ? a.duration : null); if (track.clipStart >= a.duration) { wanted.current = false; a.pause(); setLoading(false); setError("试听起点超出音频长度，请编辑歌曲调整起点。"); } else a.currentTime = track.clipStart; }}
      onPlay={e => { if (!wanted.current) { e.currentTarget.pause(); return; } window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: e.currentTarget })); setPlaying(true); }}
      onPlaying={() => setLoading(false)} onWaiting={() => { if (wanted.current) setLoading(true); }}
      onPause={() => setPlaying(false)} onEnded={() => { wanted.current = false; setPlaying(false); }}
      onError={() => { resolved.current = null; if (wanted.current) setError(remote ? "网易云音源暂时无法播放，再次点击试听会刷新地址。也可更换版本或上传音频。" : "音频无法加载，请检查文件或直链。可以跳过这组。"); wanted.current = false; setLoading(false); setPlaying(false); }}
      onTimeUpdate={e => { const a = e.currentTarget; setElapsed(Math.min(length, Math.max(0, a.currentTime - track.clipStart))); if (a.currentTime >= end) { wanted.current = false; a.pause(); } }} />
    <div className="flex items-center gap-2 sm:gap-3">
      <button type="button" disabled={disabled} onClick={() => void toggle()} aria-label={`${playing || loading ? "暂停" : "试听"} ${track.title}`} aria-keyshortcuts={shortcut} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-anime-cyan/40 bg-anime-cyan/10 text-lg text-anime-cyan hover:bg-anime-cyan/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 disabled:opacity-40">{loading ? "…" : playing ? "Ⅱ" : "▶"}</button>
      <label className="min-w-0 flex-1 text-[10px] text-slate-400 sm:text-xs"><span className="flex flex-wrap justify-between gap-x-1"><span>{loading ? "正在加载" : playing ? "正在试听" : "试听片段"}</span><span className="whitespace-nowrap tabular-nums">{timestamp(elapsed)} / {timestamp(length)}</span></span>
        <input aria-label={`${track.title} 试听进度`} className="mt-2 h-2 w-full accent-teal-300" type="range" min={0} max={length} step={0.1} value={Math.min(elapsed, length)} disabled={duration === null}
          onChange={e => { if (audio.current) { audio.current.currentTime = track.clipStart + Number(e.target.value); setElapsed(Number(e.target.value)); } }} />
      </label>
    </div>
    <div className="flex flex-wrap items-start justify-between gap-x-2 text-xs text-slate-400">
      <button type="button" disabled={disabled || loading} aria-label={`重播片段 ${track.title}`} onClick={() => void toggle(true)} className="min-h-9 text-left hover:text-anime-cyan disabled:opacity-40">↺ 重播</button>
      <details className="min-w-0 flex-1 text-right"><summary className="min-h-9 cursor-pointer py-2">音量</summary><input aria-label={`${track.title} 音量`} type="range" min={0} max={1} step={0.05} value={volume} className="h-8 w-full min-w-0 accent-teal-300" onChange={e => { const v = Number(e.target.value); window.dispatchEvent(new CustomEvent("anisong:volume", { detail: v })); try { localStorage.setItem("anisong.volume", String(v)); } catch { /* Optional preference storage. */ } }} /></details>
    </div>
    {remote && <p className="text-[10px] leading-5 text-slate-400"><a href={`https://music.163.com/#/song?id=${track.source.kind === "netease" ? track.source.id : ""}`} target="_blank" rel="noreferrer" className="underline hover:text-anime-cyan">网易云音乐 ↗</a>{trial ? " · 平台试听片段" : " · 播放以账号权限为准"}</p>}
    {error && <p role="alert" className="text-xs leading-5 text-amber-200">{error}</p>}
  </div>;
}
