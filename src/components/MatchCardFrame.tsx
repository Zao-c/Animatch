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
  return <article aria-busy={disabled} data-playback={playbackState} className={"group flex min-w-0 flex-col transition-colors " + (highlighted ? (mode === "music" ? "rounded-xl ring-2 ring-zinc-200/80" : "rounded-xl ring-2 ring-amber-300/80") : "") + " " + className}>
    <div className={"relative h-[clamp(15rem,46dvh,30rem)] w-full overflow-hidden rounded-xl bg-[#0c0d10] ring-1 ring-white/[0.08] transition duration-200 group-hover:ring-white/30 sm:h-[clamp(26rem,70dvh,56rem)] " + heroClassName}>
      <div className="h-full w-full transition duration-300 group-hover:scale-[1.015]">{artwork}</div>
      <button type="button" disabled={disabled} onClick={onPick} aria-label={"选择" + (side === "left" ? "左边" : "右边") + "：" + title} className="absolute inset-0 z-10 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-wait" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center bg-gradient-to-t from-black/80 via-black/25 to-transparent pb-4 pt-14 text-sm font-semibold text-white opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        {label}
      </span>
      {mediaControls && <div className={mode === "music" ? "absolute inset-x-0 bottom-0 z-20" : "absolute inset-x-2 bottom-2 z-20"}>{mediaControls}</div>}
    </div>
    <h2 title={title} className="mt-2.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-zinc-100 sm:text-base">{title}</h2>
    {children}
    <button type="button" onClick={onPick} disabled={disabled} className={"mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent px-2 text-xs font-medium text-zinc-400 transition-colors hover:border-white/15 hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait sm:text-sm " + (mode === "season" ? "text-amber-200/90 hover:text-amber-100" : "")}>
      <kbd aria-hidden="true" className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-zinc-400 sm:inline">{side === "left" ? "←" : "→"}</kbd>{label}
    </button>
    {afterAction}
  </article>;
}
