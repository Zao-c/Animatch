"use client";
/* eslint-disable @next/next/no-img-element -- Covers can be user-provided URLs and local blob previews. */
import { useState } from "react";

export function SongCover({ src, title, className = "", eager = false }: { src?: string | null; title: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={`relative aspect-square shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900 ${className}`}>
    {src && failed !== src ? <img src={src} alt={`${title} 封面`} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(src)} className="absolute inset-0 h-full w-full object-cover" /> :
      <div role="img" aria-label={`${title} 暂无封面`} className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-cyan-950 via-slate-900 to-violet-950 text-cyan-200"><span aria-hidden className="text-3xl">♪</span><span className="text-[10px] text-slate-400">{src ? "封面加载失败" : "暂无封面"}</span></div>}
  </div>;
}
