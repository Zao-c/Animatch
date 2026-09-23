"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { featureRequest } from "@/lib/feature-api";

interface RecapItem { animeId: string; title: string; titleCn?: string | null; eloScore?: number; score?: number; compareCount?: number; comparisonCount?: number }

export function MatchRecap({ count, scopeKey, endpoint, resultHref, season = false }: {
  count: number; scopeKey: string; endpoint: string; resultHref: string; season?: boolean;
}) {
  const milestone = Math.floor(count / 10) * 10;
  const [dismissed, setDismissed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [top, setTop] = useState<RecapItem[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    try { setDismissed(Number(sessionStorage.getItem(`recap:${scopeKey}`)) || 0); } catch { /* optional persistence */ }
  }, [scopeKey]);
  useEffect(() => {
    if (!expanded || milestone === 0) return;
    const abort = new AbortController(); setTop(null); setError(false);
    featureRequest<{ tiers?: Record<string, RecapItem[]>; currentUserRanking?: RecapItem[] }>(endpoint, { signal: abort.signal })
      .then((data) => {
        const items = data.currentUserRanking ?? Object.values(data.tiers ?? {}).flat();
        setTop(items.filter((item) => (item.compareCount ?? item.comparisonCount ?? 0) > 0)
          .sort((a, b) => (b.eloScore ?? b.score ?? 0) - (a.eloScore ?? a.score ?? 0)).slice(0, 3));
      }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [expanded, milestone, endpoint]);
  if (milestone === 0 || milestone <= dismissed) return null;
  return <aside className="my-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3" aria-label="对决阶段小结">
    <div className="flex flex-wrap items-center justify-between gap-2"><button className="min-h-11 text-left text-sm font-semibold text-cyan-100" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>阶段小结 · 已完成 {count} {season ? "票" : "场有效对决"} · {expanded ? "收起" : "看看当前偏好"}</button>
      <button type="button" className="min-h-11 px-2 text-xs text-slate-400" onClick={() => { setDismissed(milestone); setExpanded(false); try { sessionStorage.setItem(`recap:${scopeKey}`, String(milestone)); } catch { /* optional persistence */ } }}>继续对决</button></div>
    {expanded && <div className="pb-2"><p className="text-xs leading-6 text-slate-400">这是当前 Elo 暂时靠前的作品。继续比较熟悉的作品，排序会逐步完善；跳过和未看过不计入阶段进度。</p>
      {error ? <p className="mt-2 text-sm text-slate-400">小结暂时无法加载，已完成的对决不受影响。</p> : top === null ? <p role="status" className="mt-2 text-sm text-slate-400">正在整理…</p> : <ol className="mt-2 grid gap-2 sm:grid-cols-3">{top.map((item, index) => <li key={item.animeId} className="truncate rounded-lg bg-white/5 p-2 text-sm">{index + 1}. {item.titleCn ?? item.title}</li>)}</ol>}
      <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-cyan-100 underline" href={resultHref}>查看我的完整榜单</Link></div>}
  </aside>;
}
