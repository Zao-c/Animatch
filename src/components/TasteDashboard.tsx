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
  const [tab, setTab] = useState<"taste" | "matches">("taste");
  const [year, setYear] = useState("");
  const [scope, setScope] = useState("");
  const [matches, setMatches] = useState<Matches | null>(null);
  const [matching, setMatching] = useState(false);
  const [reload, setReload] = useState(0);
  const [matchError, setMatchError] = useState<string | null>(null);
  useEffect(() => { setTab("taste"); setYear(""); }, [username]);
  useEffect(() => {
    const abort = new AbortController(); setData(null); setMatches(null); setError(null); setScope("");
    featureRequest<Profile>(`/api/users/${encodeURIComponent(username)}/taste${year ? `?year=${year}` : ""}`, { signal: abort.signal })
      .then((result) => { if (abort.signal.aborted) return; setData(result); setScope(result.scopes[0]?.id ?? ""); if (!result.isOwner) setTab("taste"); })
      .catch((e) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [username, year, reload]);
  useEffect(() => {
    setMatches(null); setMatchError(null); setMatching(false);
    if (tab !== "matches" || !scope || !data?.isOwner) return;
    const abort = new AbortController(); setMatching(true);
    featureRequest<Matches>(`/api/taste/matches?scope=${encodeURIComponent(scope)}`, { signal: abort.signal })
      .then((result) => { if (!abort.signal.aborted) setMatches(result); }).catch((e) => { if (!abort.signal.aborted) setMatchError(e.message); })
      .finally(() => { if (!abort.signal.aborted) setMatching(false); });
    return () => abort.abort();
  }, [tab, scope, data?.isOwner, reload]);
  return <section className="min-w-0 space-y-4" aria-label="个人口味与匹配">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">口味分析</h2>{data?.isOwner && <Link href="/collections" className={appButtonClasses({ variant: "ghost", size: "sm" })}>年度组合</Link>}</div>
    {error ? <div role="alert" className="mb-4 text-sm text-rose-200">{error} <button className="min-h-11 underline" onClick={() => setReload((n) => n + 1)}>重试</button></div> : null}
    {!data && !error ? <p role="status" className="py-6 text-sm text-slate-400">正在整理口味记录…</p> : data?.profile ? <>
      <DashboardTabs id="taste-profile" label="口味内容" value={tab} onChange={setTab} items={[{ value: "taste" as const, label: data.isOwner ? "我的口味" : "TA 的口味" }, ...(data.isOwner ? [{ value: "matches" as const, label: "与别人比较" }] : [])]} />
      <div role="tabpanel" id={`taste-profile-panel-${tab}`} aria-labelledby={`taste-profile-tab-${tab}`} className="mt-4 min-w-0">
        {tab === "taste" ? <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">{data.profile.animeCount} 部作品 · {data.profile.scopeCount} 个评价范围</p><label className="flex items-center gap-2 text-xs text-slate-400">年份 <select aria-label="筛选口味分析年份" className={field} value={year} onChange={(e) => setYear(e.target.value)}><option value="">全部记录</option>{Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - index).map((y) => <option key={y} value={y}>{y} 年</option>)}</select></label></div>
          <div className="mt-5"><h3 className="font-semibold text-white">常排前面的作品</h3>{data.profile.favorites.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{data.profile.favorites.map((item) => <div key={item.animeId} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-2">{item.imageUrl ? <AnimeCover src={item.imageUrl} title={item.title} animeId={item.animeId} size="sm" /> : <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-slate-400" aria-hidden="true">{item.title.slice(0, 1)}</div>}<div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>{item.scopeCount > 1 ? <p className="mt-1 text-xs text-slate-400">在 {item.scopeCount} 个评价范围中出现</p> : null}</div></div>)}</div> : <p className="mt-3 text-sm text-slate-400">再进行几轮对决，就能看出哪些作品经常排在前面。</p>}</div>
          <div className="mt-6 border-t border-white/10 pt-5"><h3 className="font-semibold text-white">常看题材</h3>{data.profile.tags.length ? <div className="mt-3 flex flex-wrap gap-2">{data.profile.tags.map((item) => <span key={item.tag} className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-sm text-cyan-100">{item.tag} <span className="ml-1 text-xs text-slate-400">{item.count} 部</span></span>)}</div> : <p className="mt-3 text-sm text-slate-400">这些作品暂时缺少可靠的题材信息，因此先不猜你的题材偏好。</p>}</div>
        </> : <>
          {data.scopes.length ? <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="min-w-0 flex-1 text-sm text-slate-300">对比范围
                <select className={`${field} mt-2 w-full min-w-0`} value={scope} onChange={(e) => setScope(e.target.value)}>
                  {data.scopes.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.count} 部</option>)}
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">只对比双方都评价过的作品，至少需要 5 部。分数是排序接近程度，不是统计置信度。</p>
            {matching && <p role="status" className="py-5 text-sm text-slate-300">正在比较…</p>}
            {matchError && <p role="alert" className="mt-3 text-sm text-rose-200">{matchError}<button className="ml-3 min-h-11 underline" onClick={() => setReload((n) => n + 1)}>重试</button></p>}
            {matches && <div className="mt-5 space-y-4">
              <p className="text-xs text-slate-400">可比较 {matches.candidateCount} 位用户</p>
              {matches.candidateCount ?
                <div className="grid items-start gap-5 lg:grid-cols-2">
                  <MatchColumn title="口味最接近" kind="closest" items={matches.closest} />
                  {matches.furthest.length > 0 && <MatchColumn title="分歧较大" kind="furthest" items={matches.furthest} />}
                </div>
                : <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">暂无足够的共同评价，可以换个番组。</p>}
            </div>}
          </> : <p className="py-4 text-sm text-slate-400">参加公开番组对决后，就能与其他用户比较口味。</p>}
        </>}
      </div>
    </> : data && !data.visible ? <p className="rounded-xl border border-white/10 p-5 text-sm text-slate-300">这位用户选择了私人资料，口味档案暂不对外展示。</p> : null}
  </section>;
}

function MatchColumn({ title, kind, items }: { title: string; kind: "closest" | "furthest"; items: Matches["closest"] }) {
  return <section aria-label={title} className="min-w-0">
    <h3 className="mb-2 text-sm font-semibold text-slate-200">{title}</h3>
    <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
      {items.map((item) => {
        const evidence = kind === "closest" ? item.agreements : item.disagreements;
        const similarity = item.similarity === null ? null : Math.round(item.similarity);
        return <article key={item.username} className="min-w-0 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-slate-200">{item.name.slice(0, 1)}</span>
              <div className="min-w-0">
                <Link href={`/u/${encodeURIComponent(item.username)}`} className="block truncate text-sm font-semibold text-white hover:text-cyan-200 hover:underline">{item.name}</Link>
                <p className="text-xs text-slate-400">共同评价 {item.commonCount} 部{item.commonCount < 10 ? " · 样本较少" : ""}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-lg font-semibold tabular-nums text-cyan-100">{similarity ?? "—"}</span><span className="ml-1 text-xs text-slate-400">/100</span>
              <p className="text-[11px] text-slate-500">排序相似度</p>
            </div>
          </div>
          {similarity !== null && <progress aria-label={`与${item.name}的排序相似度`} value={Math.max(0, Math.min(100, similarity))} max={100} className="mt-3 h-1.5 w-full accent-cyan-300" />}
          {(evidence.length > 0 || item.recommendations.length > 0) && <details className="mt-2 text-xs text-slate-400">
            <summary className="flex min-h-9 cursor-pointer items-center hover:text-white">查看对比作品</summary>
            {evidence.length > 0 && <div className="mt-1 space-y-1.5">
              <p className="font-medium text-slate-300">{kind === "closest" ? "共同喜欢" : "评分分歧"}</p>
              <ul className="space-y-1">{evidence.map((work) =>
                <li key={work.animeId} className="flex flex-wrap items-center justify-between gap-x-2 rounded-md bg-white/[0.035] px-2 py-1.5">
                  <span className="text-slate-200">{work.title}</span>
                  {kind === "furthest" && <span>{work.leftOffset > 0 ? "你排得更高" : "对方排得更高"}</span>}
                </li>)}</ul>
            </div>}
            {item.recommendations.length > 0 && <div className="mt-3">
              <p className="font-medium text-slate-300">对方喜欢、你还没评价</p>
              <ul className="mt-1 space-y-1">{item.recommendations.map((work) =>
                <li key={work.animeId}>{work.title}{work.markedUnseen ? "（已标记未看）" : ""}</li>)}</ul>
            </div>}
          </details>}
        </article>;
      })}
    </div>
  </section>;
}
