"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { featureRequest } from "@/lib/feature-api";
import type { getPublicTasteRivalry } from "@/lib/taste-rivalry";
import type { findTasteMatches } from "@/lib/taste-service";

type Rivalry = Awaited<ReturnType<typeof getPublicTasteRivalry>>;
type Matches = Awaited<ReturnType<typeof findTasteMatches>>;

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
        if (response.status === 404 || response.status === 403) { setHidden(true); return null; }
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error("加载失败");
        return result.data as Rivalry;
      })
      .then((result) => { if (result) setRivalry(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    featureRequest<Matches>(`/api/taste/matches?scope=${encodeURIComponent(scope)}`, { signal: controller.signal })
      .then(setMatches).catch(() => { /* Visitors and nonparticipants still see the public result. */ });
    return () => controller.abort();
  }, [scope, reload]);

  if (hidden) return null;
  const pair = rivalry?.pair;
  return <section className="mt-5 rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-4 sm:p-5" aria-label="群友口味对照">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-bold text-white">{scope.startsWith("season:") ? "赛季" : "番组"}口味对照</h2><p className="mt-1 text-xs leading-5 text-slate-400">找出共同喜欢的作品，以及同一作品一人排高、一人排低的分歧。</p></div>{rivalry ? <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{rivalry.participantCount} 人有有效评价</span> : null}</div>
    {error ? <p className="mt-4 text-sm text-rose-200">口味对照加载失败。<button className="ml-2 underline" onClick={() => setReload((value) => value + 1)}>重试</button></p> : !rivalry ? <p className="mt-4 text-sm text-slate-400">正在比较群友口味…</p> : <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.035] p-4"><h3 className="font-semibold text-amber-100">{scope.startsWith("season:") ? "本赛季最有仇" : "这组最有分歧"}</h3>{pair ? <><p className="mt-2 text-sm text-white"><Link className="font-semibold hover:underline" href={`/u/${encodeURIComponent(pair.left.username)}`}>{pair.left.name}</Link><span className="mx-2 text-slate-500">vs</span><Link className="font-semibold hover:underline" href={`/u/${encodeURIComponent(pair.right.username)}`}>{pair.right.name}</Link></p><p className="mt-1 text-xs text-slate-400">共同评价 {pair.commonCount} 部，其中 {pair.conflictCount} 部出现明显一高一低</p><ul className="mt-3 space-y-1.5">{pair.examples.slice(0, 3).map((work) => <li key={work.animeId} className="rounded-lg bg-slate-950/50 px-2.5 py-2 text-xs text-slate-200"><span className="font-medium text-white">{work.title}</span><span className="ml-2 text-slate-400">{pair.left.name} {work.leftElo} · {pair.right.name} {work.rightElo} Elo</span><span className="ml-2 text-amber-200">{work.leftOffset > 0 ? pair.left.name : pair.right.name} 排高</span></li>)}</ul>{pair.examples.length > 3 ? <details className="mt-2 text-xs text-amber-100"><summary className="cursor-pointer">再看 {pair.examples.length - 3} 部</summary><ul className="mt-2 space-y-1">{pair.examples.slice(3).map((work) => <li key={work.animeId}>{work.title} · {work.leftElo} / {work.rightElo} Elo · {work.leftOffset > 0 ? pair.left.name : pair.right.name} 排高</li>)}</ul></details> : null}</> : <p className="mt-3 text-sm leading-6 text-slate-400">{rivalry.participantCount < 2 ? "至少两位玩家完成对决后才会出现。" : "目前还没有哪两人同时在多部作品上形成明显高低差。"}</p>}</div>
      <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4"><h3 className="font-semibold text-cyan-100">和你的口味</h3>{matches ? <>{matches.closest[0] ? <p className="mt-2 text-sm text-slate-200">最合拍：<Link className="font-semibold text-white hover:underline" href={`/u/${encodeURIComponent(matches.closest[0].username)}`}>{matches.closest[0].name}</Link> · 共同高分 {matches.closest[0].agreementCount} 部</p> : null}{matches.furthest[0] ? <p className="mt-2 text-sm text-slate-200">分歧最多：<Link className="font-semibold text-white hover:underline" href={`/u/${encodeURIComponent(matches.furthest[0].username)}`}>{matches.furthest[0].name}</Link> · 一高一低 {matches.furthest[0].disagreementCount} 部</p> : null}{matches.closest[0]?.recommendations.length ? <div className="mt-3 border-t border-white/10 pt-3"><p className="text-xs font-semibold text-cyan-100">TA 喜欢、你还没评价</p><p className="mt-1 text-xs leading-5 text-slate-300">{matches.closest[0].recommendations.map((item) => item.title).join("、")}</p></div> : null}{!matches.candidateCount ? <p className="mt-2 text-sm text-slate-400">你和这组群友还需要更多共同评价。</p> : null}</> : <p className="mt-3 text-sm leading-6 text-slate-400">登录并参与这个范围的对决后，会显示你的搭子、分歧和新作品推荐。</p>}</div>
    </div>}
    {rivalry?.pair ? <p className="mt-3 text-xs text-slate-500">高低以每个人在本范围内的 Elo 中位数为基准；名单只在有足够共同作品和多部明显分歧时显示。</p> : null}
  </section>;
}
