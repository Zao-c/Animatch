"use client";
/* eslint-disable @next/next/no-img-element -- Saved and blob covers may be user-provided. */
import { useState } from "react";
import { songCoverCandidates } from "@/lib/anisong/cover-quality";

type Props = { src?: string | null; title: string; className?: string; eager?: boolean; variant?: "thumbnail" | "hero" };
export function SongCover(props: Props) {
  return <SongCoverImage key={[props.src ?? "", props.variant ?? "thumbnail"].join("|")} {...props} />;
}
function SongCoverImage({ src, title, className = "", eager = false, variant = "thumbnail" }: Props) {
  const candidates = songCoverCandidates(src);
  const [failedIndex, setFailedIndex] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const source = candidates[failedIndex] ?? null;
  const hero = variant === "hero";
  const lowRes = hero && naturalSize !== null && Math.min(naturalSize.width, naturalSize.height) < 320;
  return <div className={"relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-cyan-950/80 via-slate-900 to-violet-950/70 " + (hero ? "flex h-full w-full items-center justify-center" : "aspect-square") + " " + className}>
    {source ? <img src={source} alt={title + " 封面"} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer"
      onLoad={event => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      onError={() => { setFailedIndex(index => index + 1); setNaturalSize(null); }}
      style={hero && naturalSize ? {
        maxWidth: Math.max(96, Math.round(naturalSize.width * 1.25)) + "px",
        maxHeight: Math.max(96, Math.round(naturalSize.height * 1.25)) + "px"
      } : undefined}
      className={hero ? "relative max-h-full max-w-full object-contain" : "absolute inset-0 h-full w-full object-cover"} /> :
      <div role="img" aria-label={title + " 暂无封面"} className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-cyan-200">
        <span aria-hidden className="text-3xl">♪</span>
        <span className="text-center text-[10px] text-slate-400">{src ? "封面加载失败" : "暂无封面"}</span>
      </div>}
    {lowRes && <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-slate-950/85 px-1.5 py-0.5 text-[10px] text-slate-400">低清封面</span>}
  </div>;
}
