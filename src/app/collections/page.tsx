"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AnimeCover } from "@/components/AnimeCover";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { DashboardTabs } from "@/components/ui/DashboardTabs";
import { CollectionPager } from "@/components/ui/CollectionPager";
import { featureRequest } from "@/lib/feature-api";
import type { CollectionInput, getCollection } from "@/lib/collection-service";

type Collection = Awaited<ReturnType<typeof getCollection>>;
type Summary = { id: string; title: string; year: number; finalPoolId: string | null; _count: { sources: number } };
type Source = { id: string; title: string; status: string; poolId: string; pool: { name: string } };
const quarters = ["冬季 · 1–3 月", "春季 · 4–6 月", "夏季 · 7–9 月", "秋季 · 10–12 月"];
const panel = "rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5";
const field = "min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-slate-950 px-3 text-sm text-white";

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Summary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [detail, setDetail] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"review" | "compare">("review");
  const [view, setView] = useState<"personal" | "community">("personal");
  const [quarter, setQuarter] = useState(1);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<CollectionInput>({ title: "2026 年度动画", year: 2026, sources: [] });
  const [editId, setEditId] = useState<string | undefined>();
  const [options, setOptions] = useState<Source[]>([]);
  const [query, setQuery] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const list = await featureRequest<Summary[]>("/api/collections");
    setCollections(list);
    return list;
  }, []);
  useEffect(() => {
    let cancelled = false;
    loadList().then((list) => { if (!cancelled) setActiveId(new URLSearchParams(window.location.search).get("id") ?? list[0]?.id ?? ""); })
      .catch((e) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loadList]);
  useEffect(() => {
    setDetail(null);
    if (!activeId) return;
    const abort = new AbortController();
    setDetailLoading(true); setError(null); setPage(1);
    featureRequest<Collection>(`/api/collections/${encodeURIComponent(activeId)}`, { signal: abort.signal })
      .then(setDetail).catch((e) => { if (!abort.signal.aborted) setError(e.message); })
      .finally(() => { if (!abort.signal.aborted) setDetailLoading(false); });
    return () => abort.abort();
  }, [activeId, reload]);
  useEffect(() => {
    if (!editing) return;
    const abort = new AbortController();
    setSourceLoading(true); setSourceError(null);
    const timer = setTimeout(() => {
      featureRequest<Source[]>(`/api/collections/sources?q=${encodeURIComponent(query)}`, { signal: abort.signal })
        .then(setOptions).catch((e) => { if (!abort.signal.aborted) setSourceError(e.message); })
        .finally(() => { if (!abort.signal.aborted) setSourceLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query, editing]);

  function openEditor(existing?: Collection) {
    setEditId(existing?.id); setError(null);
    setForm(existing ? { title: existing.title, year: existing.year, sources: existing.sources.map((source) => ({ seasonId: source.seasonId, quarter: source.quarter, phase: source.phase as "OPENING" | "ENDING" })) }
      : { title: `${new Date().getFullYear()} 年度动画`, year: new Date().getFullYear(), sources: [] });
    setEditing(true);
  }
  async function save() {
    setBusy(true); setError(null);
    try {
      const saved = await featureRequest<{ id: string }>(editId ? `/api/collections/${editId}` : "/api/collections", { method: editId ? "PATCH" : "POST", body: JSON.stringify(form) });
      await loadList(); setActiveId(saved.id); setReload((n) => n + 1); setEditing(false);
      window.history.replaceState(null, "", `/collections?id=${saved.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); } finally { setBusy(false); }
  }
  async function annualFinal() {
    if (!detail) return;
    setBusy(true); setError(null);
    try {
      const result = await featureRequest<{ poolId: string }>(`/api/collections/${detail.id}/final`, { method: "POST" });
      window.location.assign(`/pools/${result.poolId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "创建失败"); setBusy(false); }
  }
  async function remove() {
    if (!detail || !window.confirm("删除这个组合？来源赛季和已生成的年度番组会保留。")) return;
    setBusy(true); setError(null);
    try { await featureRequest(`/api/collections/${detail.id}`, { method: "DELETE" }); const list = await loadList(); setActiveId(list[0]?.id ?? ""); }
    catch (e) { setError(e instanceof Error ? e.message : "删除失败"); } finally { setBusy(false); }
  }
  const differences = detail?.comparisons.find((item) => item.quarter === quarter)?.[view] ?? [];
  const pages = Math.max(1, Math.ceil(differences.length / 8));
  const currentPage = Math.min(page, pages);

  return <PageShell>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold tracking-widest text-cyan-200">年度与阶段回顾</p><h1 className="mt-2 text-3xl font-black">把四季，连成你的这一年</h1>
        <p className="mt-3 text-sm text-slate-400">组合开播与完结记录，回顾变化，再开启一轮年度对决。组合仅本人可见。</p></div>
      <AppButton onClick={() => openEditor()} disabled={busy}>新建组合</AppButton>
    </header>
    {error && <div role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error}<div className="mt-2 flex gap-4"><button className="min-h-11 underline" onClick={() => window.location.reload()}>重试加载</button><Link className="inline-flex min-h-11 items-center underline" href="/login?next=%2Fcollections">前往登录</Link></div></div>}
    {loading ? <p role="status" className={panel}>正在加载年度组合…</p> : <div className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <label className="block text-sm text-slate-300 lg:hidden">我的组合<select className={`${field} mt-2`} value={activeId} onChange={(e) => { setActiveId(e.target.value); setEditing(false); window.history.replaceState(null, "", `/collections?id=${e.target.value}`); }}>{!collections.length && <option value="">还没有组合</option>}{collections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <aside className={`${panel} hidden self-start lg:block`}><h2 className="mb-3 font-bold">我的组合</h2>
        <div className="max-h-[50dvh] space-y-2 overflow-y-auto">{collections.map((item) => <button key={item.id} onClick={() => { setActiveId(item.id); setEditing(false); window.history.replaceState(null, "", `/collections?id=${item.id}`); }} aria-pressed={activeId === item.id}
          className={`min-h-16 w-full rounded-xl border p-3 text-left ${activeId === item.id ? "border-cyan-300/40 bg-cyan-300/10" : "border-white/10 hover:bg-white/5"}`}><span className="block break-words font-semibold">{item.title}</span><span className="text-xs text-slate-400">{item.year} · {item._count.sources} 个阶段</span></button>)}</div>
        {!collections.length && <p className="text-sm leading-6 text-slate-400">还没有组合。先选一个赛季，之后可以逐季补齐。</p>}
      </aside>
      <div className="min-w-0 space-y-5">
        {editing ? <section className={panel} aria-label="编辑年度组合"><h2 className="text-xl font-bold">{editId ? "编辑组合" : "新建组合"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]"><label className="space-y-2 text-sm">组合名称<input className={field} value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label className="space-y-2 text-sm">年份<input type="number" min={2000} max={2100} className={field} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></label></div>
          <label className="mt-4 block space-y-2 text-sm">搜索来源赛季<input className={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="番组名称或赛季名称" /></label>
          <p className="mt-2 text-xs text-slate-400">选择你可以访问的赛季，最多显示 100 个搜索结果。年份由你指定；支持先添加部分季度。</p>
          {sourceLoading && <p role="status" className="mt-2 text-sm text-cyan-200">正在查找赛季…</p>}{sourceError && <p role="alert" className="mt-2 text-sm text-rose-200">{sourceError}</p>}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">{quarters.map((label, index) => <fieldset key={label} className="min-w-0 rounded-xl border border-white/10 p-3"><legend className="px-1 text-sm font-bold">{label}</legend>
            {(["OPENING", "ENDING"] as const).map((phase) => { const selected = form.sources.find((s) => s.quarter === index + 1 && s.phase === phase)?.seasonId ?? ""; return <label key={phase} className="mt-2 block space-y-1 text-xs text-slate-300">{phase === "OPENING" ? "开播评价" : "完结评价"}<select className={field} value={selected} onChange={(e) => setForm({ ...form, sources: [...form.sources.filter((s) => !(s.quarter === index + 1 && s.phase === phase)), ...(e.target.value ? [{ seasonId: e.target.value, quarter: index + 1, phase }] : [])] })}>
              <option value="">暂不添加</option>{selected && !options.some((s) => s.id === selected) && <option value={selected}>已选赛季（搜索以更换）</option>}{options.map((s) => <option key={s.id} value={s.id} disabled={s.id !== selected && form.sources.some((entry) => entry.seasonId === s.id)}>{s.pool.name} / {s.title}</option>)}</select></label>; })}</fieldset>)}</div>
          <div className="mt-5 flex flex-wrap gap-3"><AppButton onClick={save} disabled={busy || !form.sources.length}>{busy ? "保存中…" : "保存组合"}</AppButton><AppButton variant="secondary" onClick={() => setEditing(false)} disabled={busy}>取消</AppButton></div>
        </section> : detailLoading ? <p role="status" className={panel}>正在整理各阶段记录…</p> : detail ? <>
          <section className={panel}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black">{detail.title}</h2><p className="mt-2 text-sm text-slate-400">{detail.animeCount} 部去重作品 · 你评价过 {detail.evaluatedCount} 部 · {detail.sources.length} 个阶段</p></div>
            <details className="text-sm"><summary className="min-h-11 cursor-pointer px-3 py-3">组合设置</summary><div className="flex flex-wrap gap-2"><AppButton variant="secondary" disabled={!!detail.finalPoolId || busy} onClick={() => openEditor(detail)}>编辑来源</AppButton><AppButton variant="secondary" disabled={busy} onClick={remove}>删除组合</AppButton></div>{detail.finalPoolId && <p className="mt-2 max-w-xs text-xs text-slate-400">年度对决已创建，来源已锁定。</p>}</details></div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4"><div><h3 className="font-bold text-cyan-100">年度总决选</h3><p className="mt-1 text-sm text-slate-400">优先合并各季度完结阶段；缺失时使用开播候选。通过跨季度对决形成年度榜。</p><p className="mt-1 text-xs text-slate-400">创建后组合来源锁定；建议补齐四季后再创建。新番组默认私有，可在番组设置中公开并创建年度赛季。</p></div>
              {detail.finalPoolId ? <Link className={appButtonClasses({ variant: "primary" })} href={`/pools/${detail.finalPoolId}`}>进入年度番组</Link> : <AppButton onClick={annualFinal} disabled={busy || detail.animeCount < 2}>{busy ? "准备中…" : "创建年度对决"}</AppButton>}</div>
          </section>
          <DashboardTabs id="annual" label="年度内容" value={tab} onChange={setTab} items={[{ value: "review", label: "四季回顾" }, { value: "compare", label: "开播与完结对照" }]} />
          <section role="tabpanel" id={`annual-panel-${tab}`} aria-labelledby={`annual-tab-${tab}`}>
          {tab === "review" ? <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm text-slate-300 sm:hidden">查看季度<select className={`${field} mt-2`} value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>{quarters.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>{quarters.map((label, index) => {
            const sources = detail.sources.filter((s) => s.quarter === index + 1);
            const preferred = sources.find((s) => s.phase === "ENDING" && !s.unavailable) ?? sources.find((s) => !s.unavailable);
            const favorites = [...(preferred?.personal ?? [])].sort((a, b) => b.score - a.score).slice(0, 3);
            return <article key={label} className={`${panel} ${quarter === index + 1 ? "" : "hidden sm:block"}`}><h3 className="font-bold">{label}</h3>
              {!sources.length && <p className="mt-4 text-sm text-slate-400">等待添加这一季的记录。</p>}
              {sources.map((source) => <div key={source.id} className="mt-3 text-sm"><span className="mr-2 rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300">{source.phase === "ENDING" ? "完结" : "开播"}</span>{source.unavailable ? <span>来源暂不可访问</span> : <Link className="text-cyan-100 hover:underline" href={`/pools/${source.poolId}/seasons/${source.seasonId}`}>{source.title}</Link>}
                <p className="mt-2 text-xs text-slate-400">{source.capturedAt ? `已保存快照 · ${new Date(source.capturedAt).toLocaleDateString("zh-CN")}` : "实时记录 · 尚未定稿"}</p></div>)}
              {preferred && <><p className="mt-4 text-xs font-semibold text-slate-300">我的阶段偏好 · {preferred.phase === "ENDING" ? "完结" : "开播暂评"}</p><div className="mt-2 grid grid-cols-3 gap-2">{favorites.map((item) => <div key={item.animeId} className="min-w-0"><AnimeCover src={item.imageUrl} title={item.title} size="sm" className="aspect-[3/4] w-full" /><p className="mt-1 line-clamp-2 text-xs text-slate-300">{item.title}</p></div>)}</div>{!favorites.length && <p className="mt-2 text-sm text-slate-400">你还没有在这个阶段留下有效评价。</p>}</>}
            </article>;
          })}</div> : <div className={panel}>
            <div className="flex flex-wrap gap-3"><label className="min-w-40 flex-1 text-sm">季度<select className={`${field} mt-2`} value={quarter} onChange={(e) => { setQuarter(Number(e.target.value)); setPage(1); }}>{quarters.map((q, i) => <option key={q} value={i + 1}>{q}</option>)}</select></label><label className="min-w-40 flex-1 text-sm">比较范围<select className={`${field} mt-2`} value={view} onChange={(e) => { setView(e.target.value as typeof view); setPage(1); }}><option value="personal">我的变化</option><option value="community">社区变化</option></select></label></div>
            <p className="my-4 text-sm leading-6 text-slate-400">只对两个阶段都评价过的作品重新排序，名次可出现并列。社区对照仅使用达到正式门槛的作品；两阶段参与者可能不同，变化不等于同一批人改变了看法。</p>
            {!differences.length ? <p className="rounded-xl bg-white/5 p-5 text-sm text-slate-300">暂时无法对照。请添加开播和完结两个阶段，并在两阶段留下共同作品的有效评价。</p> : <><p className="mb-3 text-xs text-slate-400">共同评价 {differences.length} 部 · 按变化幅度排列</p><div className="space-y-2">{differences.slice((currentPage - 1) * 8, currentPage * 8).map((item) => <div key={item.animeId} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><AnimeCover src={item.imageUrl} title={item.title} size="sm" className="h-14 w-10 shrink-0" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-400">第 {item.beforeRank} → 第 {item.afterRank}</p></div><span className={`shrink-0 text-sm font-bold ${item.change > 0 ? "text-cyan-200" : item.change < 0 ? "text-amber-200" : "text-slate-400"}`}>{item.change > 0 ? `上升 ${item.change}` : item.change < 0 ? `下降 ${-item.change}` : "持平"}</span></div>)}</div><div className="mt-4"><CollectionPager label="对照作品" page={currentPage} pageSize={8} total={differences.length} onChange={setPage} /></div></>}
          </div>}</section>
        </> : <section className={panel}><h2 className="text-xl font-bold">从一个季度开始</h2><p className="mt-3 text-sm leading-7 text-slate-400">新建组合，选择已有的开播与完结赛季。四季记录会逐步汇集在这里，年底再一起选出年度最爱。</p><AppButton className="mt-5" onClick={() => openEditor()}>选择来源赛季</AppButton></section>}
      </div>
    </div>}
  </PageShell>;
}
