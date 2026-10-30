"use client";
import { useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";

export function SongClipEditor({ src, initialStart = 0, initialLength = 30, remote = false }: { src: string; initialStart?: number; initialLength?: number; remote?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const previewing = useRef(false);
  const generation = useRef(0);
  const [start, setStart] = useState(String(initialStart));
  const [length, setLength] = useState(String(initialLength));
  const [duration, setDuration] = useState<number | null>(null);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState("");
  const offset = Number(start);
  const seconds = Number(length);
  const valid = start !== "" && length !== "" && Number.isFinite(offset) && Number.isFinite(seconds) && offset >= 0 && offset <= 3600 && seconds >= 5 && seconds <= 90;
  useEffect(() => {
    const element = audio.current;
    const currentGeneration = generation;
    previewing.current = false; setDuration(null); setPosition(0); setError("");
    function stop(event: Event) { if ((event as CustomEvent).detail !== element) { generation.current++; previewing.current = false; element?.pause(); } }
    window.addEventListener("anisong:play", stop);
    return () => { currentGeneration.current++; window.removeEventListener("anisong:play", stop); element?.pause(); };
  }, [src]);
  function stopPreview() { generation.current++; previewing.current = false; audio.current?.pause(); }
  async function preview() {
    const element = audio.current;
    if (!element || !valid) return;
    if (duration !== null && offset >= duration) { setError("试听起点超出音频长度，请重新选择。"); return; }
    setError(""); window.dispatchEvent(new CustomEvent("anisong:play", { detail: element }));
    previewing.current = true;
    const current = ++generation.current;
    try {
      if (element.readyState === 0 || element.error) element.load();
      else element.currentTime = offset;
      await element.play();
    } catch (e) { if (generation.current === current) { if (!(e instanceof DOMException && e.name === "AbortError")) setError("暂时无法试听，请检查音频文件或直链。"); previewing.current = false; } }
  }
  return <div className="space-y-4 rounded-xl border border-white/10 p-4">
    <div><h3 className="text-sm font-semibold">选择试听片段</h3><p className="mt-1 text-xs leading-5 text-slate-400">先用播放器找到喜欢的段落，再设为起点。保存前可以试听这段音乐。</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">试听起点（秒）<input name="clipStart" type="number" required min={0} max={duration === null ? 3600 : Math.min(3600, Math.max(0, Math.ceil(duration * 10) / 10 - 0.1))} step={0.1} value={start} onChange={e => { stopPreview(); setError(""); setStart(e.target.value); }} className="anime-field mt-1.5" /></label>
      <label className="text-sm">试听长度（秒）<input name="clipLength" type="number" required min={5} max={90} step={1} value={length} onChange={e => { stopPreview(); setLength(e.target.value); }} className="anime-field mt-1.5" /></label>
    </div>
    {src ? <>
      <audio key={src} ref={audio} src={src} controls preload="none" aria-label="编辑歌曲试听" className="h-11 w-full min-w-0"
        onLoadedMetadata={e => {
          const element = e.currentTarget;
          const total = Number.isFinite(element.duration) ? element.duration : null;
          setDuration(total);
          if (previewing.current) {
            if (total !== null && offset >= total) { stopPreview(); setError("试听起点超出音频长度，请重新选择。"); }
            else element.currentTime = offset;
          }
        }}
        onPlay={e => { if (!e.currentTarget.paused) window.dispatchEvent(new CustomEvent("anisong:play", { detail: e.currentTarget })); }}
        onPause={e => { if (e.currentTarget === audio.current && e.currentTarget.paused) { generation.current++; previewing.current = false; } }}
        onTimeUpdate={e => { const element = e.currentTarget; setPosition(element.currentTime); if (previewing.current && element.currentTime >= offset + seconds) stopPreview(); }}
        onError={() => { previewing.current = false; setError("音频无法加载，可以更换文件或检查直链后重试。"); }} />
      <div className="flex flex-wrap gap-2"><AppButton type="button" size="sm" variant="ghost" disabled={duration === null} onClick={() => { stopPreview(); setError(""); setStart(String(Math.min(3600, Math.max(0, Math.floor(Math.min(position, Math.max(0, (duration ?? 0) - 0.1)) * 10) / 10)))); }}>用当前位置作为起点</AppButton><AppButton type="button" size="sm" disabled={!valid} onClick={() => void preview()}>试听所选片段</AppButton>{[15, 30, 60].map(value => <AppButton key={value} type="button" size="sm" variant="quiet" aria-pressed={seconds === value} onClick={() => { stopPreview(); setLength(String(value)); }}>{value}秒</AppButton>)}</div>
      <p className="text-xs text-slate-400">{valid ? `${offset.toFixed(1)}秒 → ${Math.min(offset + seconds, duration ?? Infinity).toFixed(1)}秒` : "请填写有效的起点和长度"}{duration !== null ? ` · 音频全长 ${duration.toFixed(1)}秒` : " · 播放后显示音频时长"}{duration !== null && offset + seconds > duration && offset < duration ? "（到音频结尾停止）" : ""}</p>
    </> : <p className="text-xs text-slate-500">{remote ? "起点相对于平台返回的音频片段；保存后在曲单中试听。若平台仅提供短片段，建议起点设为0。" : "选择音频文件或填写直链后，即可在这里试听。"}</p>}
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
  </div>;
}
