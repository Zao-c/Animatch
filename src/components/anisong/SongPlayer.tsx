"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SongAudioProvider, SongPlayback, SongTrack } from "@/lib/anisong/types";
import { songRequest } from "@/lib/anisong/client";
import { AUDIO_PROVIDER_LABELS, songPlaybackPlan } from "@/lib/anisong/playback";
import { usePlaybackPreferences } from "./SongPlaybackPreferences";
import { SongPlayerPopover } from "./SongPlayerPopover";
const PLAY_EVENT = "anisong:play";
const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export type PlaybackState = "idle" | "loading" | "playing";
export function SongPlayer({ track, boardId, shortcut, disabled = false, onPlaybackChange, compact = false }: { compact?: boolean; track: SongTrack; boardId: string; shortcut?: "q" | "e"; disabled?: boolean; onPlaybackChange?: (state: PlaybackState) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const wanted = useRef(false), generation = useRef(0);
  const resolution = useRef<AbortController | null>(null);
  const cache = useRef(new Map<SongAudioProvider, SongPlayback>());
  const watchdog = useRef<number | null>(null);
  const attempt = useRef({ index: 0, plan: [] as SongAudioProvider[], resolving: false, activeUrl: "", reasons: [] as string[] });
  const active = useRef({ start: track.clipStart, length: track.clipLength });
  const [playing, setPlaying] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0), [duration, setDuration] = useState<number | null>(null);
  const [clip, setClip] = useState({ start: track.clipStart, length: track.clipLength });
  const [volume, setVolume] = useState(0.8), [provider, setProvider] = useState<SongAudioProvider | null>(null);
  const [trial, setTrial] = useState(false), [storeUrl, setStoreUrl] = useState(track.itunes?.storeUrl || "");
  const preferences = usePlaybackPreferences();
  const hasAudio = track.source.kind !== "none" || Boolean(track.itunes);
  const end = Math.min(clip.start + clip.length, duration ?? Infinity), length = Math.max(0, end - clip.start);
  const clearTimer = useCallback(() => { if (watchdog.current !== null) window.clearTimeout(watchdog.current); watchdog.current = null; }, []);
  const stop = useCallback(() => { wanted.current = false; generation.current++; resolution.current?.abort(); clearTimer(); audio.current?.pause(); setLoading(false); setPlaying(false); }, [clearTimer]);
  useEffect(() => { onPlaybackChange?.(loading ? "loading" : playing ? "playing" : "idle"); }, [playing, loading, onPlaybackChange]);
  useEffect(() => { stop(); setNotice(""); setError(""); }, [preferences.preferred, preferences.fallback, stop]);
  useEffect(() => {
    if (!shortcut || !hasAudio) return;
    function keyboard(event: KeyboardEvent) {
      if (disabled || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.key.toLowerCase() !== shortcut) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable=false])")) return;
      event.preventDefault(); toggle();
    }
    window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard);
  });
  useEffect(() => {
    const element = audio.current; let saved = 0.8;
    try { const value = localStorage.getItem("anisong.volume"); if (value !== null && Number.isFinite(Number(value))) saved = Math.max(0, Math.min(1, Number(value))); } catch { /* Optional preference storage. */ }
    if (element) element.volume = saved; setVolume(saved);
    function volumeChanged(event: Event) { const value = (event as CustomEvent<number>).detail; if (Number.isFinite(value) && value >= 0 && value <= 1) { if (element) element.volume = value; setVolume(value); } }
    function otherPlays(event: Event) { if ((event as CustomEvent).detail !== element) stop(); }
    function accountChanged() { if (track.source.kind === "netease") { stop(); cache.current.delete("original"); } }
    window.addEventListener(PLAY_EVENT, otherPlays); window.addEventListener("anisong:volume", volumeChanged); window.addEventListener("anisong:netease-account", accountChanged);
    const pending = resolution, currentGeneration = generation;
    return () => { wanted.current = false; currentGeneration.current++; pending.current?.abort(); clearTimer(); element?.pause(); window.removeEventListener(PLAY_EVENT, otherPlays); window.removeEventListener("anisong:volume", volumeChanged); window.removeEventListener("anisong:netease-account", accountChanged); };
  }, [clearTimer, stop, track.source.kind]);
  function live(token: number, index: number) { return wanted.current && generation.current === token && attempt.current.index === index; }
  function timeout(token: number, index: number, milliseconds: number) { clearTimer(); watchdog.current = window.setTimeout(() => { if (live(token, index)) advance("加载超时", token, index); }, milliseconds); }
  function advance(reason: string, token = generation.current, index = attempt.current.index) {
    if (!live(token, index)) return;
    clearTimer(); resolution.current?.abort(); audio.current?.pause();
    const previous = attempt.current.plan[index]; cache.current.delete(previous); attempt.current.reasons.push(reason);
    if (index + 1 >= attempt.current.plan.length) { wanted.current = false; setLoading(false); setPlaying(false); setError(attempt.current.plan.length > 1 ? `两种音源均未能播放：${reason}。请稍后重试，或反馈给曲单创建者补充音频。` : reason); return; }
    const next = attempt.current.plan[index + 1]; setNotice(`${AUDIO_PROVIDER_LABELS[previous]}${reason === "加载超时" ? "加载超时" : "暂时不可用"}，正在尝试${AUDIO_PROVIDER_LABELS[next]}…`);
    void tryProvider(index + 1, token, true);
  }
  async function tryProvider(index: number, token: number, restart: boolean) {
    const element = audio.current; if (!element || !wanted.current || token !== generation.current) return;
    const selected = attempt.current.plan[index]; attempt.current.index = index; attempt.current.resolving = true; attempt.current.activeUrl = "";
    element.pause(); setPlaying(false); setLoading(true); setError(""); setProvider(selected); clearTimer(); resolution.current?.abort();
    const controller = new AbortController(); resolution.current = controller; timeout(token, index, 8000);
    try {
      let playback = cache.current.get(selected);
      if (!playback || playback.expiresAt <= Date.now() + 5000 || element.error) {
        if (selected === "original" && (track.source.kind === "upload" || track.source.kind === "url")) playback = { provider: selected, url: track.source.kind === "upload" ? `/api/anisong/boards/${boardId}/audio/${track.id}` : track.source.url, expiresAt: Date.now() + 3600000, trial: false, start: track.clipStart, length: track.clipLength };
        else playback = await songRequest<SongPlayback>(`/api/anisong/boards/${boardId}/playback/${track.id}?provider=${selected}`, { signal: controller.signal });
        if (!live(token, index)) return;
        cache.current.set(selected, playback);
      }
      if (!live(token, index)) return;
      const config = { start: Number.isFinite(playback.start) ? playback.start : selected === "itunes" ? 0 : track.clipStart, length: Number.isFinite(playback.length) ? playback.length : track.clipLength };
      active.current = config; setClip(config); setTrial(playback.trial); setStoreUrl(playback.storeUrl || track.itunes?.storeUrl || "");
      const url = new URL(playback.url, window.location.origin).href;
      attempt.current.activeUrl = url; attempt.current.resolving = false;
      const same = element.currentSrc === url && !element.error;
      if (!same) { setDuration(null); setElapsed(0); element.src = url; element.load(); }
      else {
        const boundary = Math.min(config.start + config.length, Number.isFinite(element.duration) ? element.duration : Infinity);
        if (restart || element.currentTime < config.start || element.currentTime >= boundary - 0.1) { element.currentTime = config.start; setElapsed(0); }
      }
      await element.play();
      if (live(token, index) && !element.paused) { clearTimer(); setLoading(false); setPlaying(true); }
    } catch (cause) {
      if (!live(token, index)) return;
      if (cause instanceof DOMException && cause.name === "NotAllowedError") { stop(); setError("浏览器需要再次点击试听才能播放，请重试。"); return; }
      advance(cause instanceof Error && !(cause instanceof DOMException) ? cause.message : "音频暂时无法播放", token, index);
    }
  }
  function toggle(restart = false) {
    if (!audio.current || disabled) return;
    if (wanted.current && !restart) { stop(); return; }
    const plan = songPlaybackPlan(track, preferences);
    if (!plan.length) { setError(preferences.preferred === "itunes" ? "尚未匹配 iTunes 音源，可改用公共音频池或开启自动切换。" : "尚未补充公共音频，可改用 iTunes 或开启自动切换。"); return; }
    stop(); window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: audio.current }));
    wanted.current = true; const token = ++generation.current;
    attempt.current = { index: 0, plan, resolving: false, activeUrl: "", reasons: [] };
    setNotice((preferences.preferred === "itunes" && plan[0] !== "itunes") || (preferences.preferred === "pool" && plan[0] === "itunes") ? `首选音源尚未补充，改用${AUDIO_PROVIDER_LABELS[plan[0]]}` : "");
    void tryProvider(0, token, restart);
  }
  if (!hasAudio) return <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs leading-5 text-slate-400">尚未添加音频，可凭印象选择或在曲单中补充。</p>;
  return <div className={`song-player space-y-1 rounded-xl border p-2 transition-colors ${compact ? "song-player-compact bg-slate-950/90" : "sm:p-3"} ${playing || loading ? "border-anime-cyan/30 bg-anime-cyan/5" : compact ? "border-white/15" : "border-white/10 bg-slate-950/30"}`}>
    <audio ref={audio} preload="none"
      onLoadedMetadata={event => { const element = event.currentTarget; if (element.currentSrc !== attempt.current.activeUrl) return; setDuration(Number.isFinite(element.duration) ? element.duration : null); if (active.current.start >= element.duration) { advance("试听起点超出音频长度，请编辑调整"); } else element.currentTime = active.current.start; }}
      onPlay={event => { if (!wanted.current || event.currentTarget.currentSrc !== attempt.current.activeUrl) { event.currentTarget.pause(); return; } window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: event.currentTarget })); setPlaying(true); }}
      onPlaying={() => { if (wanted.current) { clearTimer(); setLoading(false); setPlaying(true); if (attempt.current.index > 0) setNotice(`已改用${AUDIO_PROVIDER_LABELS[attempt.current.plan[attempt.current.index]]}，从对应片段起点重播`); } }}
      onWaiting={() => { if (wanted.current && !attempt.current.resolving) { setLoading(true); if (watchdog.current === null) timeout(generation.current, attempt.current.index, 6000); } }}
      onStalled={() => { if (wanted.current && !attempt.current.resolving && watchdog.current === null) timeout(generation.current, attempt.current.index, 6000); }}
      onPause={() => setPlaying(false)} onEnded={() => { wanted.current = false; clearTimer(); setLoading(false); setPlaying(false); }}
      onError={event => { if (wanted.current && !attempt.current.resolving && event.currentTarget.error) advance("音频加载失败"); }}
      onTimeUpdate={event => { const element = event.currentTarget; const boundary = Math.min(active.current.start + active.current.length, Number.isFinite(element.duration) ? element.duration : Infinity); setElapsed(Math.max(0, Math.min(active.current.length, element.currentTime - active.current.start))); if (element.currentTime >= boundary) { wanted.current = false; clearTimer(); element.pause(); setLoading(false); } }} />
    <div className={"song-player-controls"}>
      <button type="button" disabled={disabled} onClick={() => toggle()} aria-label={`${playing || loading ? "暂停" : "试听"} ${track.title}`} aria-keyshortcuts={shortcut} className={`flex ${compact ? "h-9 w-9" : "h-11 w-11"} shrink-0 items-center justify-center rounded-full border border-anime-cyan/40 bg-anime-cyan/10 text-lg text-anime-cyan hover:bg-anime-cyan/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 disabled:opacity-40`}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={"h-5 w-5 " + (loading ? "animate-spin motion-reduce:animate-none" : "")}>
        {loading ? <path d="M21 12a9 9 0 1 1-6-8.5" /> : playing ? <><path d="M9 5v14" /><path d="M15 5v14" /></> : <path d="m9 5 11 7-11 7z" />}
      </svg></button>
      <label className="w-full min-w-0 flex-1 text-[10px] text-slate-400 sm:text-xs"><span className="flex flex-wrap justify-between gap-x-1"><span className={"song-player-caption"}>{loading ? "正在加载" : playing ? "正在试听" : "试听片段"}</span><span className="whitespace-nowrap tabular-nums">{timestamp(elapsed)} / {timestamp(length)}</span></span>
        <input aria-label={`${track.title} 试听进度`} className="mt-2 h-2 w-full accent-teal-300" type="range" min={0} max={length} step={0.1} value={Math.min(elapsed, length)} disabled={duration === null} onChange={event => { if (audio.current) { audio.current.currentTime = clip.start + Number(event.target.value); setElapsed(Number(event.target.value)); } }} />
      </label>
    </div>
    <div className="flex min-h-8 items-center justify-between gap-1">
    <SongPlayerPopover label="音量与音源详情">    <div className="flex flex-wrap items-start justify-between gap-x-2 text-xs text-slate-400">
      <button type="button" disabled={disabled || loading} aria-label={`重播片段 ${track.title}`} onClick={() => toggle(true)} className="min-h-9 text-left hover:text-anime-cyan disabled:opacity-40">↺ 重播</button>
      <label className="min-w-0 flex-1 text-right"><span className="block py-2">音量</span><input aria-label={`${track.title} 音量`} type="range" min={0} max={1} step={0.05} value={volume} className="h-8 w-full min-w-0 accent-teal-300" onChange={event => { const value = Number(event.target.value); window.dispatchEvent(new CustomEvent("anisong:volume", { detail: value })); try { localStorage.setItem("anisong.volume", String(value)); } catch { /* Optional preference storage. */ } }} /></label>
    </div>
    <p className="text-[10px] leading-5 text-slate-400">{provider ? AUDIO_PROVIDER_LABELS[provider] : track.source.kind === "pool" ? "公共音频池" : track.source.kind === "itunes" ? "iTunes" : "原音源"}{trial ? " · 平台试听片段" : ""}</p>
    {track.source.kind === "netease" && <a href={`https://music.163.com/#/song?id=${track.source.id}`} target="_blank" rel="noreferrer" className="block text-[10px] text-slate-400 underline">网易云音乐 ↗</a>}
    {storeUrl && <p className="text-[10px] leading-5 text-slate-400"><a href={storeUrl} target="_blank" rel="noreferrer" className="underline hover:text-anime-cyan">在 iTunes 中查看 ↗</a>{provider === "itunes" && <span className="block">provided courtesy of iTunes</span>}</p>}
</SongPlayerPopover>
    <span aria-live="polite" className={error || notice ? "sr-only" : "min-w-0 flex-1 truncate text-[10px] text-slate-400"} role={error ? "alert" : "status"}>{error || notice || (loading ? "加载中…" : error ? "试听失败" : notice ? "音源已切换" : playing ? "正在试听" : "")}</span>
    {(error || notice) && <SongPlayerPopover label="状态详情">{error || notice}</SongPlayerPopover>}
    </div>
  </div>;
}
