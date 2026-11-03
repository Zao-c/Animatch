"use client";
import { useRef, useState } from "react";

/** Sharing a URL never publishes audio, creates a Tier snapshot, or changes visibility. */
export function SongShareButton({ path, label = "分享曲单" }: { path: string; label?: string }) {
  const [feedback, setFeedback] = useState("");
  const [manual, setManual] = useState("");
  const fallback = useRef<HTMLInputElement>(null);
  async function share() {
    const url = new URL(path, window.location.origin).href;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else throw new Error("Clipboard API unavailable");
      setFeedback("曲单网址已复制"); setManual("");
    } catch {
      setManual(url); setFeedback("浏览器限制复制，请手动复制下方网址");
      window.requestAnimationFrame(() => { fallback.current?.focus(); fallback.current?.select(); });
    }
  }
  return <span className="inline-flex min-w-0 flex-col items-start gap-1">
    <button type="button" onClick={() => void share()} className="inline-flex min-h-9 items-center justify-center rounded-xl border border-anime-purple/40 bg-anime-purple/10 px-3 text-sm font-semibold text-slate-100 transition hover:border-anime-cyan/50 hover:bg-white/10">↗ {label}</button>
    {feedback && <span role="status" className="text-xs text-cyan-100">{feedback}</span>}
    {manual && <input ref={fallback} aria-label="手动复制曲单网址" readOnly value={manual} className="anime-field max-w-full text-xs" onFocus={event => event.currentTarget.select()} />}
  </span>;
}
