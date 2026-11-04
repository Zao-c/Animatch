"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { featureRequest } from "@/lib/feature-api";
import type { getPublicTasteRivalry } from "@/lib/taste-rivalry";
import type { findTasteMatches, getTasteProfile } from "@/lib/taste-service";

type Rivalry = Awaited<ReturnType<typeof getPublicTasteRivalry>>;
type Matches = Awaited<ReturnType<typeof findTasteMatches>>;
type Profile = Awaited<ReturnType<typeof getTasteProfile>>;

export function TasteRivalryCard({ scope }: { scope: string }) {
  const [rivalry, setRivalry] = useState<Rivalry | null>(null);
  const [matches, setMatches] = useState<Matches | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRivalry(null); setMatches(null); setHidden(false); setError(false);
    fetch(`/api/taste/rivalry?scope=${encodeURIComponent(scope)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404 || response.status === 403) { if (!controller.signal.aborted) setHidden(true); return null; }
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error("加载失败");
        return result.data as Rivalry;
      })
      .then((result) => { if (result && !controller.signal.aborted) setRivalry(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    void (async () => {
      try {
        const { user } = await featureRequest<{ user: { username: string | null } | null }>("/api/auth/me", { signal: controller.signal });
        if (!user?.username) return;
        const profile = await featureRequest<Profile>(`/api/users/${encodeURIComponent(user.username)}/taste`, { signal: controller.signal });
        if (!profile.scopes.some((item) => item.id === scope)) return;
        const result = await featureRequest<Matches>(`/api/taste/matches?scope=${encodeURIComponent(scope)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setMatches(result);
      } catch { /* The public result remains available if a personal request fails. */ }
    })();
    return () => controller.abort();
  }, [scope, reload]);

  if (hidden) return null;
  const pair = rivalry?.pair;
  const closest = matches?.closest[0] ?? null;
  const furthest = matches?.furthest[0] ?? null;
  return <section className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5" aria-label="群友口味对照">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-white">群友口味对照</h2>
      {rivalry && <span className="text-xs text-slate-400">{rivalry.participantCount} 位公开参与者</span>}
    </header>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-200">口味对照加载失败。<button type="button" className="ml-2 min-h-11 underline" onClick={() => setReload((value) => value + 1)}>重试</button></p> :
      !rivalry ? <p role="status" className="mt-3 text-sm text-slate-400">正在比较…</p> :
      <div className="mt-4 grid items-start gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 text-xs font-semibold text-slate-400">分歧最大的一组</h3>
          {pair ? <>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white">
              <Link href={`/u/${encodeURIComponent(pair.left.username)}`} className="font-semibold hover:text-cyan-200 hover:underline">{pair.left.name}</Link>
              <span aria-hidden="true" className="text-slate-500">×</span>
              <Link href={`/u/${encodeURIComponent(pair.right.username)}`} className="font-semibold hover:text-cyan-200 hover:underline">{pair.right.name}</Link>
            </p>
            <p className="mt-1 text-xs text-slate-400">共同评价 {pair.commonCount} 部 · 明显分歧 {pair.conflictCount} 部</p>
            {pair.examples.length > 0 && <details className="mt-2 text-xs text-slate-400">
              <summary className="flex min-h-9 cursor-pointer items-center hover:text-white">查看分歧作品</summary>
              <ul className="mt-1 space-y-1.5">
                {pair.examples.map((work) => <li key={work.animeId} className="flex flex-wrap items-center justify-between gap-x-2 rounded-lg bg-white/[0.035] px-2.5 py-2">
                  <span className="font-medium text-slate-200">{work.title}</span>
                  <span>{work.leftOffset > 0 ? pair.left.name : pair.right.name} 排得更高</span>
                </li>)}
              </ul>
              <p className="mt-2 text-slate-500">依据各自在本范围内的相对排序，仅展示有足够共同评价的公开用户。</p>
            </details>}
          </> : <p className="text-sm text-slate-400">{rivalry.participantCount < 2 ? "参与人数不足，暂时无法对照。" : "暂无足够明显的分歧。"}</p>}
        </div>
        <div className="min-w-0 border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <h3 className="mb-2 text-xs font-semibold text-slate-400">与你的口味</h3>
          {closest ? <>
            <p className="text-sm text-slate-200">最接近：<Link href={`/u/${encodeURIComponent(closest.username)}`} className="font-semibold text-white hover:text-cyan-200 hover:underline">{closest.name}</Link></p>
            <p className="mt-1 text-xs text-slate-400">共同评价 {closest.commonCount} 部 · 排序相似度 {closest.similarity ?? "—"}/100{closest.commonCount < 10 ? " · 样本较少" : ""}</p>
            {furthest && <p className="mt-3 text-sm text-slate-200">分歧较大：<Link href={`/u/${encodeURIComponent(furthest.username)}`} className="font-semibold text-white hover:text-cyan-200 hover:underline">{furthest.name}</Link></p>}
            {closest.recommendations.length > 0 && <details className="mt-2 text-xs text-slate-400">
              <summary className="flex min-h-9 cursor-pointer items-center hover:text-white">对方推荐的作品</summary>
              <ul className="space-y-1.5 pb-1">{closest.recommendations.map((work) =>
                <li key={work.animeId} className="text-slate-300">{work.title}</li>)}</ul>
            </details>}
          </> : <p className="text-sm text-slate-400">{matches ? "共同评价还不足，暂时无法比较。" : "参与这个番组的对决后，可以比较与群友的口味。"}</p>}
        </div>
      </div>}
  </section>;
}
