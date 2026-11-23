"use client";
import { useEffect, useState } from "react";
import { DEFAULT_PLAYBACK_PREFERENCES, type PlaybackPreferences } from "@/lib/anisong/playback";
const EVENT = "anisong:source-preference";
const STORAGE = "anisong.playback-preferences";
function read(): PlaybackPreferences {
  try { const value = JSON.parse(localStorage.getItem(STORAGE) || "null"); if ((value?.preferred === "pool" || value?.preferred === "itunes") && typeof value.fallback === "boolean") return value; } catch { /* Optional preference storage. */ }
  return DEFAULT_PLAYBACK_PREFERENCES;
}
export function usePlaybackPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_PLAYBACK_PREFERENCES);
  useEffect(() => {
    setPreferences(read());
    function update() { setPreferences(read()); }
    function localUpdate(event: Event) { const detail = (event as CustomEvent<PlaybackPreferences>).detail; if (detail && ["pool", "itunes"].includes(detail.preferred) && typeof detail.fallback === "boolean") setPreferences(detail); }
    window.addEventListener(EVENT, localUpdate); window.addEventListener("storage", update);
    return () => { window.removeEventListener(EVENT, localUpdate); window.removeEventListener("storage", update); };
  }, []);
  return preferences;
}
export function SongPlaybackPreferences() {
  const preferences = usePlaybackPreferences();
  function update(next: PlaybackPreferences) {
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* Dispatch works without persistent storage. */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    window.dispatchEvent(new CustomEvent("anisong:play", { detail: null }));
  }
  return <section aria-label="试听音源设置" className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-white/10 bg-slate-950/30 p-3 text-sm">
    <label className="flex flex-wrap items-center gap-2 text-slate-300">试听音源<select aria-label="优先试听音源" value={preferences.preferred} onChange={event => update({ ...preferences, preferred: event.target.value as PlaybackPreferences["preferred"] })} className="anime-field min-h-10 w-auto"><option value="pool">公共音频池优先</option><option value="itunes">iTunes 优先</option></select></label>
    <label className="flex min-h-10 items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={preferences.fallback} onChange={event => update({ ...preferences, fallback: event.target.checked })} className="h-4 w-4 accent-teal-300" />音源失败时自动切换</label>
    <p className="basis-full text-xs leading-5 text-slate-500">选择会保存在当前浏览器。没有对应音源、加载失败或长时间卡住时尝试备用源；切换后从对应试听片段的起点重播。</p>
    <p className="basis-full text-xs leading-5 text-slate-500">音频按需加载，不会自动下载整份曲单。公共池允许浏览器缓存已加载的内容，缓存可能被浏览器清理。</p>
  </section>;
}
