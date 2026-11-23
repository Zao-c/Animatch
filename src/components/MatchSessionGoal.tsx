"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppButton } from "./ui/AppButton";

type SessionGoal = { size: 10 | 20; startCount: number };

/** An optional stopping point. Counts saved effective comparisons, never skips. */
export function MatchSessionGoal({ scopeKey, count, resultHref, disabled }: {
  scopeKey: string; count: number; resultHref: string; disabled: boolean;
}) {
  const [goal, setGoal] = useState<SessionGoal | null>(null);
  const [ready, setReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const key = `animatch:match-goal:${scopeKey}`;

  useEffect(() => {
    setGoal(null);
    try {
      const raw = sessionStorage.getItem(key);
      const stored = raw ? JSON.parse(raw) : null;
      if (stored && (stored.size === 10 || stored.size === 20) && Number.isSafeInteger(stored.startCount) && stored.startCount >= 0) setGoal(stored);
    } catch { setStorageFailed(true); }
    setReady(true);
  }, [key]);

  function choose(size: number) {
    const next = size === 10 || size === 20 ? { size, startCount: count } as SessionGoal : null;
    setGoal(next);
    try {
      if (next) sessionStorage.setItem(key, JSON.stringify(next));
      else sessionStorage.removeItem(key);
      setStorageFailed(false);
    } catch { setStorageFailed(true); }
  }

  const completed = goal ? Math.max(0, count - goal.startCount) : 0;
  const reached = !!goal && completed >= goal.size;
  return <div aria-label="本段对决目标" className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
    <label className="flex min-h-11 items-center gap-2">本段目标<select aria-label="本段有效对决目标" value={goal?.size ?? 0} disabled={!ready || disabled} onChange={(event) => choose(Number(event.target.value))} className="min-h-11 rounded-lg border border-white/10 bg-slate-950 px-2 text-slate-200"><option value={0}>不限</option><option value={10}>10 场</option><option value={20}>20 场</option></select></label>
    {goal && <><progress aria-label="本段已完成的有效对决" value={Math.min(completed, goal.size)} max={goal.size} className="h-2 w-24 accent-cyan-300" /><span role="status" aria-live="polite" className={reached ? "text-cyan-200" : ""}>{reached ? `目标已完成 · ${completed} 场` : `${completed} / ${goal.size} 场 · 跳过和没看过不计入`}</span></>}
    {goal && reached && <><Link href={resultHref} className="inline-flex min-h-11 items-center text-cyan-200 underline">看看榜单，休息一下</Link><AppButton size="sm" variant="quiet" disabled={disabled} onClick={() => choose(goal.size)}>再来 {goal.size} 场</AppButton></>}
    {storageFailed && <span className="text-amber-200">目标仅保留到离开当前页面，已保存的投票不受影响。</span>}
  </div>;
}
