"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardTabs } from "./ui/DashboardTabs";
import { AppButton, appButtonClasses } from "./ui/AppButton";
import { featureRequest } from "@/lib/feature-api";
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
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [reload, setReload] = useState(0);
  const [matchError, setMatchError] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController(); setData(null); setMatches(null); setError(null); setScope("");
    featureRequest<Profile>(`/api/users/${encodeURIComponent(username)}/taste${year ? `?year=${year}` : ""}`, { signal: abort.signal })
      .then((result) => { setData(result); setScope(result.scopes[0]?.id ?? ""); })
      .catch((e) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [username, year, reload]);
  useEffect(() => {
    setMatches(null); setMatchError(null); setMatching(false);
    if (tab !== "matches" || !scope || !data?.settings?.allowTasteMatching) return;
    const abort = new AbortController(); setMatching(true);
    featureRequest<Matches>(`/api/taste/matches?scope=${encodeURIComponent(scope)}`, { signal: abort.signal })
      .then(setMatches).catch((e) => { if (!abort.signal.aborted) setMatchError(e.message); })
      .finally(() => { if (!abort.signal.aborted) setMatching(false); });
    return () => abort.abort();
  }, [tab, scope, data?.settings?.allowTasteMatching, reload]);
  async function settings(publish: boolean, match: boolean) {
    setBusy(true); setError(null);
    try { await featureRequest("/api/taste/settings", { method: "PATCH", body: JSON.stringify({ tasteProfilePublic: publish, allowTasteMatching: match }) }); setReload((n) => n + 1); }
    catch (e) { setError(e instanceof Error ? e.message : "保存失败"); } finally { setBusy(false); }
  }
  return <section className="mb-8 min-w-0 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-6" aria-label="口味与年度">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">口味档案</h2><p className="mt-2 text-sm text-slate-400">从参与过的公开番组，看看你的偏好。</p></div>{data?.isOwner && <Link href="/collections" className={appButtonClasses({ variant: "secondary" })}>我的年度组合</Link>}</div>
    {error ? <div role="alert" className="mb-4 text-sm text-rose-200">{error} <button className="min-h-11 underline" onClick={() => setReload((n) => n + 1)}>重试</button></div> : null}
    {!data && !error ? <p role="status" className="py-6 text-sm text-slate-400">正在整理口味记录…</p> : data && !data.visible ? <p className="py-4 text-sm text-slate-400">这位用户尚未公开口味画像。</p> : data?.profile ? <>
      <DashboardTabs id="taste-profile" label="口味内容" value={tab} onChange={setTab} items={[{ value: "taste", label: "偏好画像" }, ...(data.isOwner ? [{ value: "matches" as const, label: "口味搭子与分歧" }] : [])]} />
      <div role="tabpanel" id={`taste-profile-panel-${tab}`} aria-labelledby={`taste-profile-tab-${tab}`} className="mt-4">
        {tab === "taste" ? <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-300">{data.profile.animeCount} 部去重作品 · {data.profile.scopeCount} 个评价范围</p><label className="text-sm text-slate-300">活动年份 <select className={field} value={year} onChange={(e) => setYear(e.target.value)}><option value="">全部记录</option>{Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - index).map((y) => <option key={y} value={y}>{y} 年</option>)}</select></label></div>
          <p className="mt-3 text-xs leading-6 text-slate-400">按有效评价记录整理；未看过不计为低分。条形表示参与作品分布，偏好值表示这些作品在各自番组中的相对位置，不是动画评分。活动年份按最近评价时间筛选。</p>
          {!data.profile.tags.length ? <p className="py-6 text-sm text-slate-400">还没有足够的带标签评价。参与公开番组的自由对决或赛季投票后，会逐步生成画像。</p> : <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">{data.profile.tags.map((item) => <div key={item.tag} className="min-w-0"><div className="flex justify-between gap-2 text-sm"><span className="truncate font-semibold">{item.tag}</span><span className="shrink-0 text-slate-400">{item.count} 部</span></div><div className="mt-2 h-2 rounded-full bg-white/5" role="meter" aria-label={`${item.tag}参与作品占比`} aria-valuemin={0} aria-valuemax={data.profile!.animeCount} aria-valuenow={item.count}><div className="h-2 rounded-full bg-cyan-300/70" style={{ width: `${item.count / data.profile!.animeCount * 100}%` }} /></div><p className="mt-1 text-xs text-slate-400">{item.preference === null ? "暂只展示参与分布" : `相对偏好 ${item.preference}/100`}</p><p className="mt-1 truncate text-xs text-slate-500" title={item.examples.join("、")}>{item.examples.join("、")}</p></div>)}</div>}
        </> : <>
          {!data.settings?.allowTasteMatching ? <div className="rounded-xl bg-white/5 p-4"><p className="text-sm leading-6 text-slate-300">开启后，其他已开启匹配的玩家可以看到你们在共同作品上的相似和分歧。只使用公开番组记录，随时可以退出。</p><AppButton className="mt-4" disabled={busy} onClick={() => settings(true, true)}>公开画像并开启匹配</AppButton></div> : <>
            <label className="block text-sm text-slate-300">在同一番组或赛季内比较<select className={`${field} mt-2 w-full min-w-0`} value={scope} onChange={(e) => setScope(e.target.value)}>{data.scopes.map((item) => <option key={item.id} value={item.id}>{item.title} · 你评价过 {item.count} 部</option>)}</select></label>
            <p className="my-3 text-xs leading-6 text-slate-400">至少共同评价 10 部才参与匹配。只比较共同作品的相对排序；相似指数不是概率。匹配顺序还会考虑共同样本数量，不把没看过算作不喜欢。</p>
            {matching && <p role="status" className="py-5 text-sm text-cyan-200">正在比较共同偏好…</p>}{matchError && <p role="alert" className="text-sm text-rose-200">{matchError}<button className="ml-3 min-h-11 underline" onClick={() => setReload((n) => n + 1)}>重试</button></p>}
            {!scope && <p className="py-4 text-sm text-slate-400">先参加一个公开番组的对决，再来寻找口味搭子。</p>}
            {matches && <><div className="grid gap-4 md:grid-cols-2"><MatchColumn title="口味搭子" items={matches.closest} /><MatchColumn title="分歧最大" items={matches.furthest} /></div><p className="mt-3 text-xs text-slate-500">本次从共同记录最多的至多 {matches.candidateLimit} 位已开启匹配的玩家中比较，有效匹配 {matches.candidateCount} 位。</p></>}
          </>}
        </>}
      </div>
      {data.isOwner && data.settings && <details className="mt-5 border-t border-white/10 pt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-slate-300">公开范围与匹配设置 · {data.settings.tasteProfilePublic ? "画像已公开" : "仅本人可见"}</summary><div className="space-y-3 text-sm text-slate-300"><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={data.settings.tasteProfilePublic} disabled={busy} onChange={(e) => settings(e.target.checked, e.target.checked && !!data.settings?.allowTasteMatching)} />在个人主页公开口味画像</label><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={data.settings.allowTasteMatching} disabled={busy || !data.settings.tasteProfilePublic} onChange={(e) => settings(true, e.target.checked)} />允许与其他玩家匹配口味</label><p className="text-xs text-slate-400">关闭公开时也会退出匹配。私有番组不进入公开画像和匹配。</p></div></details>}
    </> : null}
  </section>;
}

function MatchColumn({ title, items }: { title: string; items: Matches["closest"] }) {
  return <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><h3 className="font-bold">{title}</h3>{!items.length ? <p className="mt-3 text-sm leading-6 text-slate-400">暂时没有足够共同评价的匹配对象。邀请朋友开启口味匹配后再来看看。</p> : <div className="mt-3 space-y-3">{items.map((item) => <article key={item.username} className="rounded-lg bg-slate-950/50 p-3"><div className="flex items-start justify-between gap-3"><Link href={`/u/${encodeURIComponent(item.username)}`} className="break-all font-semibold text-cyan-100 hover:underline">{item.name}</Link><span className="shrink-0 text-sm">相似 {item.similarity}/100</span></div><p className="mt-2 text-xs leading-5 text-slate-400">共同 {item.commonCount} 部 · 你的 {item.commonCount}/{item.leftCount} · 对方的 {item.commonCount}/{item.rightCount}</p><p className="mt-2 text-xs leading-5 text-slate-300">{title === "口味搭子" && item.agreements.length ? `共同靠前：${item.agreements.map((entry) => entry.title).join("、")}` : item.disagreements.length ? `分歧作品：${item.disagreements.map((entry) => entry.title).join("、")}` : "共同作品的相对顺序一致"}</p></article>)}</div>}</section>;
}
