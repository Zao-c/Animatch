"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AWARD_TEMPLATE, CEREMONY_STATUS } from "@/lib/award-nominations";
import { featureRequest } from "@/lib/feature-api";

type Ceremony = { id: string; title: string; year: number; status: string; deadline: string };
const field = "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-base text-white";
export default function CeremoniesPage() {
  const year = new Date().getFullYear();
  const [list, setList] = useState<Ceremony[]>([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(`${year} AniMatch 年度动画大赏`), [awardYear, setAwardYear] = useState(year);
  const [description, setDescription] = useState("评选本年度看过的动画。每项最多提名 3 位候选；不了解的奖项可以跳过。最终获奖将在直播当晚投票或讨论决定。");
  const [nominationMode, setNominationMode] = useState("ASSISTED"), [accessMode, setAccessMode] = useState("APPROVAL");
  const [yearBasis, setYearBasis] = useState("WATCHED"), [allowSequels, setAllowSequels] = useState(true), [allowMovies, setAllowMovies] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [selected, setSelected] = useState(AWARD_TEMPLATE.map((a) => a.id));
  const [category, setCategory] = useState(AWARD_TEMPLATE[0].category);
  useEffect(() => {
    const controller = new AbortController();
    featureRequest<Ceremony[]>("/api/ceremonies", { signal: controller.signal }).then(setList)
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await featureRequest<{ id: string }>("/api/ceremonies", { method: "POST", body: JSON.stringify({ title, year: awardYear, description, deadline: new Date(deadline).toISOString(), awardIds: selected, nominationMode, accessMode, eligibility: { yearBasis, allowSequels, allowMovies } }) });
      window.location.assign(`/ceremonies/${result.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "创建失败"); setBusy(false); }
  }
  return <PageShell><div className="mx-auto max-w-6xl">
    <header className="mb-6 rounded-2xl border border-amber-200/20 bg-gradient-to-br from-amber-200/10 to-slate-950/30 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-widest text-amber-200">一起回顾这一年</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">年度动画大赏</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">先收下每个人的提名，再留一个晚上，一起聊喜欢的作品。</p></div>
        <AppButton variant="primary" onClick={() => setCreating(!creating)}>{creating ? "返回活动列表" : "发起年度大赏"}</AppButton></div>
      <ol className="mt-5 grid grid-cols-3 gap-2 text-xs text-slate-300 sm:text-sm"><li>01　填写提名</li><li>02　确认入围</li><li>03　相约颁奖</li></ol>
    </header>
    {error && <div role="alert" className="mb-4 rounded-xl border border-rose-300/30 p-4 text-rose-200">{error} <Link className="underline" href="/login?next=%2Fceremonies">前往登录</Link></div>}
    {creating ? <form onSubmit={create} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <fieldset disabled={busy} className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-slate-950/30 p-5">
        <legend className="px-2 font-bold">活动信息</legend>
        <label className="block text-sm">活动名称<input required maxLength={100} className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">评选年份<input required type="number" min={1960} max={2200} className={field} value={awardYear} onChange={(e) => setAwardYear(Number(e.target.value))} /></label>
          <label className="block text-sm">提名截止时间<input required type="datetime-local" className={field} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label></div>
        <p className="text-xs text-slate-400">截止时间使用你当前设备的时区。</p>
        <label className="block text-sm">作品资格与活动说明<textarea rows={4} maxLength={1500} className={field} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="block text-sm">参与范围<select className={field} value={accessMode} onChange={(e) => setAccessMode(e.target.value)}><option value="APPROVAL">组织者审核加入（熟人群推荐）</option><option value="LINK">持链接的登录用户均可参与</option></select></label>
        <label className="block text-sm">提名方式<select className={field} value={nominationMode} onChange={(e) => setNominationMode(e.target.value)}><option value="ASSISTED">群友互助 · 可以复用别人提名的候选</option><option value="INDEPENDENT">独立提名 · 不展示他人的候选</option></select></label>
        <details><summary className="cursor-pointer py-3 text-sm">参评资格</summary><label className="block text-sm">年度范围<select className={field} value={yearBasis} onChange={(e) => setYearBasis(e.target.value)}><option value="WATCHED">本年看过</option><option value="AIRED">本年播出</option><option value="UNLIMITED">不限年份</option></select></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={allowSequels} onChange={(e) => setAllowSequels(e.target.checked)} />允许续作</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={allowMovies} onChange={(e) => setAllowMovies(e.target.checked)} />允许电影</label><p className="text-xs text-slate-400">公布入围前由组织者核对，例外请在活动说明中写明。</p></details>
      </fieldset>
      <section className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/30 p-5">
        <h2 className="font-bold">本届奖项 <span className="ml-2 text-sm font-normal text-amber-200">已选 {selected.length} 项</span></h2>
        <p className="mt-2 text-sm text-slate-400">按类别勾选今年要举办的奖项，创建后固定。</p>
        <label className="mt-4 block text-sm">奖项类别<select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>{[...new Set(AWARD_TEMPLATE.map((a) => a.category))].map((c) => <option key={c}>{c}</option>)}</select></label>
        <fieldset disabled={busy} className="mt-3 space-y-1">{AWARD_TEMPLATE.filter((a) => a.category === category).map((a) => <label key={a.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-white/5"><input type="checkbox" className="h-4 w-4 accent-amber-300" checked={selected.includes(a.id)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, a.id] : old.filter((id) => id !== a.id))} /><span className="text-sm">{a.title}</span></label>)}</fieldset>
        <div className="mt-4 flex flex-wrap gap-2"><AppButton type="button" variant="quiet" disabled={busy} onClick={() => setSelected(AWARD_TEMPLATE.map((a) => a.id))}>全选</AppButton><AppButton type="button" variant="quiet" disabled={busy} onClick={() => setSelected([])}>清空选择</AppButton></div>
        <AppButton type="submit" variant="primary" className="mt-5 w-full" disabled={busy || !selected.length}>{busy ? "正在创建…" : "创建并开始征集"}</AppButton>
      </section>
    </form> : loading ? <p role="status">正在加载活动…</p> : list.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{list.map((event) => <Link key={event.id} href={`/ceremonies/${event.id}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 transition hover:border-amber-200/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
      <p className="text-xs text-amber-200">{event.status === "OPEN" && new Date(event.deadline) <= new Date() ? "提名已截止" : CEREMONY_STATUS[event.status]}</p><h2 className="mt-3 text-xl font-bold">{event.title}</h2>
      <p className="mt-4 text-sm text-slate-400">提名截止 {new Date(event.deadline).toLocaleString("zh-CN")}</p><p className="mt-6 text-sm text-amber-100">打开提名册 →</p>
    </Link>)}</div> : !error && <section className="rounded-2xl border border-dashed border-white/15 p-8 text-center"><h2 className="text-xl font-bold">你们的年度记忆，从一份提名开始</h2><p className="mt-3 text-sm text-slate-400">发起活动后把链接发给群友；收到邀请链接，也可以直接打开填写。</p></section>}
    <footer className="mt-6 text-sm text-slate-400">想先整理四季记录？ <Link href="/collections" className={appButtonClasses({ variant: "quiet" })}>前往年度组合 →</Link></footer>
  </div></PageShell>;
}
