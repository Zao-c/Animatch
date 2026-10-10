"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AnimeCover } from "./AnimeCover";
import { AppButton } from "./ui/AppButton";

type MatchMode = "personal" | "season";

export function MatchWorkspace({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl">{children}</div>;
}

export function MatchHeading({ mode, title, context, backHref, description, tools, children }: {
  mode: MatchMode; title: string; context?: ReactNode; backHref: string;
  description: string; tools?: ReactNode; children?: ReactNode;
}) {
  return <header className={`mb-4 rounded-2xl border border-white/10 border-l-4 bg-slate-950/25 p-4 sm:p-5 ${mode === "season" ? "border-l-amber-300" : "border-l-cyan-300"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2.5 py-1 font-bold ${mode === "season" ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"}`}>{mode === "season" ? "赛季投票" : "个人自由对决"}</span>
        {context}
      </div>
      <Link className="inline-flex min-h-11 items-center px-2 text-sm text-slate-300 hover:text-white" href={backHref}>{mode === "season" ? "返回赛季" : "返回番组"} →</Link>
    </div>
    <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h1 className="text-xl font-black text-white sm:text-2xl">{title}</h1><p className="mt-1 hidden text-sm leading-6 text-slate-400 sm:block">{description}</p></div>
      {tools && <div className="flex flex-wrap items-center gap-2">{tools}</div>}
    </div>
    {children}
  </header>;
}

export function MatchArena({ left, right, mode = "personal" }: { left: ReactNode; right: ReactNode; mode?: MatchMode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] sm:gap-4">
    {left}
    <div aria-hidden="true" className="flex items-center justify-center"><span className={`text-xs font-black sm:text-lg ${mode === "season" ? "text-amber-200" : "text-cyan-200"}`}>VS</span></div>
    {right}
  </div>;
}

export function MatchChoiceCard({ title, src, secondarySrc, animeId, fit, side, actionLabel, mode = "personal", disabled, highlighted, onPick, details, className = "" }: {
  title: string; src?: string | null; secondarySrc?: string | null; animeId: string;
  fit?: "cover" | "contain"; side: "left" | "right"; mode?: MatchMode;
  disabled: boolean; highlighted?: boolean; onPick: () => void; details?: ReactNode; className?: string; actionLabel?: string;
}) {
  const label = actionLabel ?? (side === "left" ? "更喜欢左边" : "更喜欢右边");
  return <article className={`flex min-w-0 flex-col rounded-2xl border bg-slate-950/35 p-2 transition-colors sm:p-3 ${highlighted ? "border-amber-200 ring-2 ring-amber-200/30" : "border-white/10"} ${disabled ? "opacity-60" : ""} ${className}`}>
    <div className="relative h-[clamp(10rem,28dvh,18rem)] w-full overflow-hidden rounded-xl bg-slate-950 sm:h-[clamp(15rem,34dvh,22rem)]">
      <AnimeCover src={src} secondarySrc={secondarySrc} animeId={animeId} title={title} size="lg" fit={fit} loading="eager" warm className="!h-full !max-h-none !aspect-auto rounded-none border-0" />
      <button type="button" disabled={disabled} onClick={onPick} aria-label={`选择${side === "left" ? "左边" : "右边"}：${title}`} className="absolute inset-0 z-10 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-wait" />
    </div>
    <h2 title={title} className="my-3 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-100 sm:min-h-12 sm:text-base sm:leading-6">{title}</h2>
    <button type="button" onClick={onPick} disabled={disabled} className={`mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold text-slate-950 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait ${mode === "season" ? "bg-amber-300 hover:bg-amber-200" : "bg-anime-cyan hover:bg-cyan-200"}`}>
      <kbd aria-hidden="true" className="hidden text-xs sm:inline">{side === "left" ? "←" : "→"}</kbd>{label}
    </button>
    <details className="relative mt-1 text-xs text-slate-400"><summary className="flex min-h-11 cursor-pointer items-center justify-center">作品信息与说明</summary><div className="absolute inset-x-0 top-full z-20 rounded-xl border border-white/15 bg-slate-950 p-3 text-sm leading-6 shadow-xl"><p className="mb-2 font-semibold text-slate-100">{title}</p>{details}</div></details>
  </article>;
}

export function MatchActions({ disabled, onSkip, onUnseen, onDraw, hint }: {
  disabled: boolean; onSkip: () => void; onUnseen: (side: "LEFT_UNSEEN" | "RIGHT_UNSEEN" | "BOTH_UNSEEN") => void;
  onDraw?: () => void; hint: string;
}) {
  return <section aria-label="其他对决操作" className="mt-3 rounded-2xl border border-white/10 bg-slate-950/20 p-2 sm:p-3">
    <div className={`grid grid-cols-2 gap-2 ${onDraw ? "lg:grid-cols-5" : "sm:grid-cols-4"}`}>
      {onDraw && <AppButton disabled={disabled} onClick={onDraw} variant="ghost"><kbd>↑</kbd><span className="ml-2">差不多</span></AppButton>}
      <AppButton disabled={disabled} onClick={onSkip} variant="ghost"><kbd>↓</kbd><span className="ml-2">跳过 / 换一组</span></AppButton>
      <AppButton disabled={disabled} onClick={() => onUnseen("LEFT_UNSEEN")} variant="quiet"><kbd>1</kbd><span className="ml-2">左边没看过</span></AppButton>
      <AppButton disabled={disabled} onClick={() => onUnseen("RIGHT_UNSEEN")} variant="quiet"><kbd>2</kbd><span className="ml-2">右边没看过</span></AppButton>
      <AppButton disabled={disabled} onClick={() => onUnseen("BOTH_UNSEEN")} variant="quiet"><kbd>0</kbd><span className="ml-2">都没看过</span></AppButton>
    </div>
    <p className="px-1 pt-2 text-xs leading-5 text-slate-400">{hint}</p>
  </section>;
}
