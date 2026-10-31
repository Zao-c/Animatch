"use client";
import type { ReactNode } from "react";

type MatchMode = "personal" | "season" | "music";

/** The same pickable shell for anime and music. Playback controls stay outside the vote hit area. */
export function MatchCardFrame({ title, side, artwork, disabled, onPick, actionLabel, highlighted = false, mode = "personal", children, afterAction, className = "", heroClassName = "", mediaControls, playbackState }: {
  title: string; side: "left" | "right"; artwork: ReactNode;
  disabled: boolean; onPick: () => void; actionLabel?: string;
  highlighted?: boolean; mode?: MatchMode;
  children?: ReactNode; afterAction?: ReactNode;
  className?: string; heroClassName?: string; mediaControls?: ReactNode; playbackState?: "idle" | "loading" | "playing";
}) {
  const label = actionLabel ?? (side === "left" ? "更喜欢左边" : "更喜欢右边");
  return <article aria-busy={disabled} data-playback={playbackState} className={"flex min-w-0 flex-col rounded-2xl border bg-slate-950/35 p-1.5 transition-colors sm:p-2 " + (highlighted ? (mode === "music" ? "border-anime-cyan/60 ring-2 ring-anime-cyan/20" : "border-amber-200 ring-2 ring-amber-200/30") : "border-white/10") + " " + className}>
    <div className={"relative h-[clamp(13rem,40dvh,26rem)] w-full overflow-hidden rounded-xl bg-slate-950 sm:h-[clamp(22rem,62dvh,50rem)] " + heroClassName}>
      {artwork}
      <button type="button" disabled={disabled} onClick={onPick} aria-label={"选择" + (side === "left" ? "左边" : "右边") + "：" + title} className="absolute inset-0 z-10 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-wait" />
      {mediaControls && <div className="absolute inset-x-2 bottom-2 z-20">{mediaControls}</div>}
    </div>
    <h2 title={title} className="my-2 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-100 sm:text-base">{title}</h2>
    {children}
    <button type="button" onClick={onPick} disabled={disabled} className={"mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold text-slate-950 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait " + (mode === "season" ? "bg-amber-300 hover:bg-amber-200" : "bg-anime-cyan hover:bg-cyan-200")}>
      <kbd aria-hidden="true" className="hidden text-xs sm:inline">{side === "left" ? "←" : "→"}</kbd>{label}
    </button>
    {afterAction}
  </article>;
}
