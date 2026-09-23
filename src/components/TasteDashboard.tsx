"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardTabs } from "./ui/DashboardTabs";
import { appButtonClasses } from "./ui/AppButton";
import { featureRequest } from "@/lib/feature-api";
import { AnimeCover } from "./AnimeCover";
import type { getTasteProfile, findTasteMatches } from "@/lib/taste-service";

type Profile = Awaited<ReturnType<typeof getTasteProfile>>;
type Matches = Awaited<ReturnType<typeof findTasteMatches>>;
const field = "min-h-11 rounded-xl border border-white/15 bg-slate-950 px-3 text-sm text-white";

export function TasteDashboard({ username }: { username: string }) {
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"taste" | "matches">("matches");
  const [year, setYear] = useState("");
  const [scope, setScope] = useState("");
  const [matches, setMatches] = useState<Matches | null>(null);
  const [matching, setMatching] = useState(false);
  const [reload, setReload] = useState(0);
  const [matchError, setMatchError] = useState<string | null>(null);
  useEffect(() => { setTab("matches"); }, [username]);
  useEffect(() => {
    const abort = new AbortController(); setData(null); setMatches(null); setError(null); setScope("");
    featureRequest<Profile>(`/api/users/${encodeURIComponent(username)}/taste${year ? `?year=${year}` : ""}`, { signal: abort.signal })
      .then((result) => { setData(result); setScope(result.scopes[0]?.id ?? ""); if (!result.isOwner) setTab("taste"); })
      .catch((e) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [username, year, reload]);
  useEffect(() => {
    setMatches(null); setMatchError(null); setMatching(false);
    if (tab !== "matches" || !scope || !data?.isOwner) return;
    const abort = new AbortController(); setMatching(true);
    featureRequest<Matches>(`/api/taste/matches?scope=${encodeURIComponent(scope)}`, { signal: abort.signal })
      .then(setMatches).catch((e) => { if (!abort.signal.aborted) setMatchError(e.message); })
      .finally(() => { if (!abort.signal.aborted) setMatching(false); });
    return () => abort.abort();
  }, [tab, scope, data?.isOwner, reload]);
  return <section className="mb-8 min-w-0 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-6" aria-label="口味与年度">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">口味档案</h2><p className="mt-2 text-sm text-slate-400">从参与过的公开番组，看看你的偏好。</p></div>{data?.isOwner && <Link href="/collections" className={appButtonClasses({ variant: "secondary" })}>我的年度组合</Link>}</div>
    {error ? <div role="alert" className="mb-4 text-sm text-rose-200">{error} <button className="min-h-11 underline" onClick={() => setReload((n) => n + 1)}>重试</button></div> : null}
    {!data && !error ? <p role="status" className="py-6 text-sm text-slate-400">正在整理口味记录…</p> : data?.profile ? <>
      <DashboardTabs id="taste-profile" label="口味内容" value={tab} onChange={setTab} items={[...(data.isOwner ? [{ value: "matches" as const, label: "口味搭子与分歧" }] : []), { value: "taste" as const, label: data.isOwner ? "我的口味" : "TA 的口味" }]} />
      <div role="tabpanel" id={`taste-profile-panel-${tab}`} aria-labelledby={`taste-profile-tab-${tab}`} className="mt-4">
        {tab === "taste" ? <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-300">已比较 {data.profile.animeCount} 部作品 · 涉及 {data.profile.scopeCount} 个番组或赛季</p><label className="text-sm text-slate-300">按时间看 <select className={field} value={year} onChange={(e) => setYear(e.target.value)}><option value="">全部记录</option>{Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - index).map((y) => <option key={y} value={y}>{y} 年</option>)}</select></label></div>
          <div className="mt-5"><h3 className="font-semibold text-white">常排前面的作品</h3><p className="mt-1 text-xs text-slate-400">根据你在各番组和赛季中的对决排序整理。</p>{data.profile.favorites.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{data.profile.favorites.map((item) => <div key={item.animeId} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2">{item.imageUrl ? <AnimeCover src={item.imageUrl} title={item.title} animeId={item.animeId} size="sm" /> : <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-slate-400" aria-hidden="true">{item.title.slice(0, 1)}</div>}<div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>{item.scopeCount > 1 ? <p className="mt-1 text-xs text-slate-400">在 {item.scopeCount} 个评价范围中出现</p> : null}</div></div>)}</div> : <p className="mt-3 text-sm text-slate-400">再进行几轮对决，就能看出哪些作品经常排在前面。</p>}</div>
          <div className="mt-6 border-t border-white/10 pt-5"><h3 className="font-semibold text-white">常看题材</h3><p className="mt-1 text-xs leading-5 text-slate-400">只统计作品上可识别的题材标签；导入来源和年份不算口味。</p>{data.profile.tags.length ? <div className="mt-3 flex flex-wrap gap-2">{data.profile.tags.map((item) => <span key={item.tag} className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-sm text-cyan-100">{item.tag} <span className="ml-1 text-xs text-slate-400">看过 {item.count} 部</span></span>)}</div> : <p className="mt-3 text-sm text-slate-400">这些作品暂时缺少可靠的题材信息，因此先不猜你的题材偏好。</p>}</div>
        </> : <>
            <label className="block text-sm text-slate-300">在同一番组或赛季内比较<select className={`${field} mt-2 w-full min-w-0`} value={scope} onChange={(e) => setScope(e.target.value)}>{data.scopes.map((item) => <option key={item.id} value={item.id}>{item.title} · 你评价过 {item.count} 部</option>)}</select></label>
            <p className="my-3 text-xs leading-6 text-slate-400">共同评价至少 5 部即可比较。具体分歧看同一作品在你们各自榜单里是否一高一低；没有评价过的作品不算低分。</p>
            {matching && <p role="status" className="py-5 text-sm text-cyan-200">正在比较共同偏好…</p>}{matchError && <p role="alert" className="text-sm text-rose-200">{matchError}<button className="ml-3 min-h-11 underline" onClick={() => setReload((n) => n + 1)}>重试</button></p>}
            {!scope && <p className="py-4 text-sm text-slate-400">先参加一个公开番组的对决，再来寻找口味搭子。</p>}
            {matches && <><p className="mb-3 text-sm text-slate-300">这个范围内找到 {matches.candidateCount} 位可以比较的群友</p>{matches.candidateCount ? <div className="space-y-4"><MatchColumn title="口味搭子" items={matches.closest} /><MatchColumn title="相对分歧最大" items={matches.furthest} /></div> : <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-300">这个番组里暂时没人与你共同评价足够作品。可以切换番组，或邀请群友多做几轮对决。</p>}</>}
        </>}
      </div>
    </> : null}
  </section>;
}

function MatchColumn({ title, items }: { title: string; items: Matches["closest"] }) {
  const isClosest = title === "口味搭子";
  function renderMatch(item: Matches["closest"][number]) {
    const evidence = isClosest ? item.agreements : item.disagreements;
    return <article key={item.username} className="rounded-xl border border-white/10 bg-slate-950/50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/u/${encodeURIComponent(item.username)}`} className="font-semibold text-cyan-100 hover:underline">{item.name}</Link><span className="text-xs text-slate-400">共同评价 {item.commonCount} 部 · 相似度 {item.similarity} 分{item.commonCount < 10 ? " · 样本较少" : ""}</span></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <div><p className="mb-2 text-xs font-semibold text-slate-300">{isClosest ? "你们都排得靠前" : "同一作品，一人高一人低"}</p>{evidence.length ? <ul className="space-y-1.5">{evidence.map((work) => <li key={work.animeId} className="rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs"><span className="font-medium text-white">{work.title}</span><span className="ml-2 text-slate-400">你 {work.leftElo} · TA {work.rightElo} Elo</span>{!isClosest ? <span className="ml-2 text-amber-200">{work.leftOffset > 0 ? "你高 / TA 低" : "TA 高 / 你低"}</span> : null}</li>)}</ul> : <p className="text-xs leading-5 text-slate-400">{isClosest ? "共同作品的整体排序接近，暂时没有同时给出明显高分的作品。" : "这组里相对差异较大，但还没有明显的一高一低作品。"}</p>}</div>
        <aside className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3"><p className="text-xs font-semibold text-cyan-100">对方喜欢、你还没评价</p>{item.recommendations.length ? <ul className="mt-2 space-y-1.5 text-xs text-slate-200">{item.recommendations.map((work) => <li key={work.animeId}>· {work.title}{work.markedUnseen ? <span className="ml-1 text-slate-400">（你标记未看）</span> : null}</li>)}</ul> : <p className="mt-2 text-xs leading-5 text-slate-400">暂时没有合适的推荐。</p>}</aside>
      </div>
    </article>;
  }
  return <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><h3 className="font-bold">{title}</h3>{!items.length ? <p className="mt-3 text-sm leading-6 text-slate-400">还没有更多群友可比较。</p> : <div className="mt-3 space-y-3">{renderMatch(items[0])}{items.length > 1 ? <details className="rounded-lg border border-white/10 px-3 py-2"><summary className="cursor-pointer text-sm text-cyan-100">再看 {items.length - 1} 位群友</summary><div className="mt-3 space-y-3">{items.slice(1).map(renderMatch)}</div></details> : null}</div>}</section>;
}
