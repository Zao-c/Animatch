"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { ballotProgress, CEREMONY_STATUS, csvCell, type NominationEntry, type Nominee, type Shortlist } from "@/lib/award-nominations";
import type { getCeremony } from "@/lib/award-service";
import { featureRequest } from "@/lib/feature-api";
import { copyTextWithFallback } from "@/lib/browser-copy";
import { AwardCandidatePicker, AwardReferencePreview } from "@/components/AwardCandidatePicker";
import { nomineeKey, referenceUrl } from "@/lib/award-nominations";

type Detail = Awaited<ReturnType<typeof getCeremony>>;
const field = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-base text-white";
const panel = "min-w-0 rounded-2xl border border-white/10 bg-slate-950/35 p-4 sm:p-5";
const emptyCandidate = (): Nominee => ({ title: "", workTitle: "", reason: "", mediaUrl: "" });
function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CeremonyPage({ params }: { params: { id: string } }) {
  const api = `/api/ceremonies/${encodeURIComponent(params.id)}`;
  const [data, setData] = useState<Detail | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [entries, setEntries] = useState<NominationEntry[]>([]), [dirty, setDirty] = useState(false);
  const [shortlist, setShortlist] = useState<Shortlist>({}), [shortlistDirty, setShortlistDirty] = useState(false);
  const [tab, setTab] = useState<"mine" | "published" | "organizer">("mine"), [activeId, setActiveId] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [candidatePage, setCandidatePage] = useState(1);
  const [deleteTitle, setDeleteTitle] = useState(""), [deleted, setDeleted] = useState(false);
  useEffect(() => { setCandidatePage(1); }, [activeId, tab]);
  const load = useCallback(async (reset = false) => {
    const next = await featureRequest<Detail>(api);
    setData(next); setActiveId((id) => id || next.awards[0]?.id || "");
    if (reset) { setEntries(next.mine.draft); setDirty(false); setShortlist(next.organizer?.shortlist ?? {}); setShortlistDirty(false); }
    return next;
  }, [api]);
  useEffect(() => { load(true).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [load]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!dirty && !shortlistDirty) return;
    const leave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const link = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const anchor = e.target.closest("a");
      if (anchor?.href && anchor.target !== "_blank" && !window.confirm("有尚未保存的修改，确定离开吗？")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", leave); document.addEventListener("click", link, true);
    return () => { window.removeEventListener("beforeunload", leave); document.removeEventListener("click", link, true); };
  }, [dirty, shortlistDirty]);

  async function refresh() {
    if ((dirty || shortlistDirty) && !window.confirm("重新载入会放弃页面上未保存的修改，继续吗？")) return;
    setBusy(true); setError("");
    try { await load(true); setNotice("已刷新到最新记录"); } catch (e) { setError(e instanceof Error ? e.message : "加载失败"); } finally { setBusy(false); }
  }
  function updateEntry(entry: NominationEntry) {
    setEntries((old) => [...old.filter((item) => item.awardId !== entry.awardId), entry]); setDirty(true); setNotice("");
  }
  async function save(action: "save" | "submit") {
    if (!data) return;
    // A completely empty added row is a placeholder; partially filled rows must pass server validation.
    const cleaned = entries.map((entry) => ({ ...entry, candidates: entry.candidates.filter((c) => [c.title, c.workTitle, c.reason, c.mediaUrl].some((v) => v.trim())) }));
    const progress = ballotProgress(cleaned, data.awards);
    if (action === "submit" && !window.confirm(`确认提交这份提名？${progress.nominated} 项已提名、${progress.skipped} 项跳过、${progress.remaining} 项未填。截止前可重新提交修改。`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await featureRequest<{ revision: number; savedAt: string; submittedAt: string | null }>(`${api}/ballot`, { method: "PUT", body: JSON.stringify({ action, revision: data.mine.revision, entries: cleaned }) });
      setEntries(cleaned); setDirty(false);
      setData((old) => old && ({ ...old, submittedCount: old.submittedCount + (action === "submit" && !old.mine.submittedAt ? 1 : 0), mine: { ...old.mine, ...saved, draft: cleaned, submitted: action === "submit" ? cleaned : old.mine.submitted } }));
      setNotice(action === "submit" ? "提名已正式提交，组织者会收到这个版本。" : "草稿已保存。正式提交后才会计入提名。" );
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败，请重试"); } finally { setBusy(false); }
  }
  async function organize(action: "freeze" | "save" | "publish") {
    if (!data) return;
    if (action === "freeze" && !window.confirm("结束征集后所有人都不能再修改提名。只汇总已经正式提交的版本，确定结束吗？")) return;
    const unselected = data.awards.filter((a) => !shortlist[a.id]?.length).length;
    if (action === "publish" && !window.confirm(`公布已勾选的入围名单？${unselected} 个奖项没有入围候选，将显示“本项暂未设入围”。公布后名单固定，最终获奖仍待现场决定。`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await featureRequest<{ revision: number }>(action === "freeze" ? api : `${api}/shortlist`, { method: action === "freeze" ? "PATCH" : "PUT", body: JSON.stringify({ revision: data.revision, shortlist, publish: action === "publish" }) });
      // Record a successful write even if the following read temporarily fails.
      setData((old) => old && ({ ...old, revision: saved.revision, status: action === "freeze" ? "FROZEN" : action === "publish" ? "PUBLISHED" : old.status }));
      setShortlistDirty(false);
      await load(false);
      setNotice(action === "freeze" ? "征集已结束，可以核对并勾选入围候选。" : action === "publish" ? "入围名单已公布；它不是最终获奖结果。" : "入围草案已保存，尚未公布。" );
    } catch (e) { setError(e instanceof Error ? e.message : "操作失败"); } finally { setBusy(false); }
  }
  async function share() {
    const result = await copyTextWithFallback(window.location.href);
    setNotice(result === "copied" ? "活动链接已复制，可以发给群友。" : `请复制浏览器地址栏里的活动链接：${window.location.href}`);
  }
  async function removeCeremony() {
    if (!data || deleteTitle !== data.title || !window.confirm(`永久删除「${data.title}」？所有人的提名和入围名单也会删除，无法恢复。`)) return;
    setBusy(true); setError("");
    try {
      await featureRequest(api, { method: "DELETE", body: JSON.stringify({ revision: data.revision, title: deleteTitle }) });
      setDirty(false); setShortlistDirty(false); setDeleted(true);
    } catch (e) { setError(e instanceof Error ? e.message : "删除失败，请重试"); } finally { setBusy(false); }
  }
  function exportSummary() {
    if (!data?.organizer) return;
    const rows: (string | number)[][] = [["奖项", "候选", "所属作品", "Bangumi 资料", "提名人数（不是决选票）", "提名者", "理由", "素材链接", "入围草案"]];
    for (const summary of data.organizer.summaries) for (const candidate of summary.candidates) for (const supporter of candidate.supporters) {
      rows.push([data.awards.find((a) => a.id === summary.awardId)?.title ?? "", candidate.title, candidate.workTitle, candidate.reference ? referenceUrl(candidate.reference) : "", candidate.count, supporter.name, supporter.reason, supporter.mediaUrl, shortlist[summary.awardId]?.includes(candidate.key) ? "是" : "否"]);
    }
    download(`年度提名汇总-${data.year}.csv`, "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }

  if (deleted) return <PageShell><div className={panel}><h1 className="text-xl font-bold">活动已删除</h1><Link href="/ceremonies" className={`${appButtonClasses()} mt-4`}>返回年度活动</Link></div></PageShell>;
  if (loading) return <PageShell><p role="status">正在打开提名册…</p></PageShell>;
  if (!data) return <PageShell><div className={panel}><h1 className="text-xl font-bold">暂时无法打开活动</h1><p role="alert" className="my-4 text-rose-200">{error}</p><Link className={appButtonClasses()} href={`/login?next=${encodeURIComponent(`/ceremonies/${params.id}`)}`}>登录后参与</Link><AppButton className="ml-2" onClick={refresh} disabled={busy}>重试</AppButton></div></PageShell>;
  const award = data.awards.find((a) => a.id === activeId) ?? data.awards[0];
  const entry = entries.find((e) => e.awardId === award.id) ?? { awardId: award.id, skipped: false, candidates: [] };
  const progress = ballotProgress(entries.map((e) => ({ ...e, candidates: e.candidates.filter((c) => c.title.trim()) })), data.awards);
  const canEdit = data.status === "OPEN" && new Date(data.deadline).getTime() > clock;
  const pendingSubmission = data.mine.submittedAt && (dirty || JSON.stringify(data.mine.draft) !== JSON.stringify(data.mine.submitted));
  const summary = data.organizer?.summaries.find((s) => s.awardId === award.id);
  const published = data.published.find((a) => a.awardId === award.id)?.candidates ?? [];

  return <PageShell><div className="mx-auto max-w-6xl">
    <header className="mb-4 rounded-2xl border border-amber-200/20 bg-gradient-to-br from-amber-200/10 to-slate-950/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-amber-200">{data.status === "OPEN" && !canEdit ? "提名已截止 · 等待整理" : CEREMONY_STATUS[data.status]}</span><Link href="/ceremonies" className="inline-flex min-h-11 items-center text-sm text-slate-300">我的年度活动 →</Link></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-black sm:text-3xl">{data.title}</h1><div className="flex gap-2"><AppButton variant="ghost" onClick={share}>邀请群友</AppButton><AppButton variant="quiet" onClick={refresh} disabled={busy}>刷新记录</AppButton></div></div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{data.ownerName} 发起 · 提名截止 {new Date(data.deadline).toLocaleString("zh-CN")}</p>
      <p className="mt-1 text-sm text-amber-100">{data.submittedCount} 人已交表 · {data.awards.length} 个奖项</p>
      <details className="mt-3 text-sm text-slate-400"><summary className="cursor-pointer py-2">活动规则与资格</summary><p className="whitespace-pre-wrap leading-7">{data.description}</p><p className="mt-2 leading-6">每项最多提名 3 位；提名不分先后，不作为最终获奖票。草稿仅自己可见。正式提交后，候选名称会出现在群友的填写提示中；组织者可查看理由与素材，其他群友看不到提名者和人数。正式入围由组织者另行确认。</p></details>
    </header>
    <nav aria-label="年度活动栏目" className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 p-2">{([
      ["mine", "我的提名"], ["published", "入围名单"], ...(data.isOwner ? [["organizer", "组织者收表"]] : [])
    ] as [typeof tab, string][]).map(([key, label]) => <AppButton key={key} aria-pressed={tab === key} variant={tab === key ? "secondary" : "quiet"} onClick={() => setTab(key)}>{label}</AppButton>)}</nav>
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200/30 p-3 text-sm text-rose-200">{error}</p>}
    {notice && <p role="status" className="mb-4 break-words rounded-xl border border-emerald-200/25 p-3 text-sm text-emerald-200">{notice}</p>}
    <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className={panel}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1"><label className="text-sm font-semibold">奖项类别<select className={field} value={award.category} onChange={(e) => setActiveId(data.awards.find((a) => a.category === e.target.value)!.id)}>{[...new Set(data.awards.map((a) => a.category))].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-sm font-semibold lg:hidden">当前奖项<select className={field} value={award.id} onChange={(e) => setActiveId(e.target.value)}>{data.awards.filter((a) => a.category === award.category).map((a) => <option key={a.id} value={a.id}>{a.title.replace(/^年度/, "")}</option>)}</select></label></div>
        <nav aria-label="选择奖项" className="mt-3 hidden gap-1 lg:grid">{data.awards.filter((a) => a.category === award.category).map((a) => {
          const mine = entries.find((e) => e.awardId === a.id), state = mine?.skipped ? "已跳过" : mine?.candidates.some((c) => c.title.trim()) ? "已填" : "待填";
          return <button type="button" aria-current={a.id === award.id ? "true" : undefined} key={a.id} onClick={() => setActiveId(a.id)} className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm ${a.id === award.id ? "border-amber-200/30 bg-amber-200/10 text-amber-100" : "border-transparent text-slate-300 hover:bg-white/5"}`}><span>{a.title.replace(/^年度/, "")}</span>{tab === "mine" && <span className="shrink-0 text-xs text-slate-400">{state}</span>}</button>;
        })}</nav>
        {tab === "mine" && <p className="mt-3 text-xs leading-6 text-slate-400 lg:border-t lg:border-white/10 lg:pt-3">已提名 {progress.nominated} · 跳过 {progress.skipped} · 待填 {progress.remaining}</p>}
      </aside>
      <section className={panel}>
        <div className="mb-4 border-b border-white/10 pb-4"><p className="text-xs text-amber-200">{award.category}</p><h2 className="mt-1 text-xl font-bold">{award.title}</h2></div>
        {tab === "mine" && <>
          <AwardCandidatePicker key={award.id} ceremonyId={data.id} award={award} initial={data.suggestions?.find((s) => s.awardId === award.id)?.candidates ?? []} selected={entry.candidates} disabled={!canEdit || busy || (entry.candidates.length >= 3 && !entry.candidates.some((c) => ![c.title, c.workTitle, c.reason, c.mediaUrl].some((v) => v.trim())))} onChoose={(candidate) => {
            if (entry.candidates.some((c) => nomineeKey(c) === nomineeKey(candidate))) return;
            const emptyIndex = entry.candidates.findIndex((c) => ![c.title, c.workTitle, c.reason, c.mediaUrl].some((v) => v.trim()));
            const next = emptyIndex >= 0 ? entry.candidates.map((c, index) => index === emptyIndex ? candidate : c) : [...entry.candidates, candidate];
            if (next.length > 3) return;
            updateEntry({ ...entry, skipped: false, candidates: next }); setNotice("");
          }} />
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-400">已选 {entry.candidates.length} / 3</p><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit || busy} checked={entry.skipped} onChange={(e) => {
            if (e.target.checked && entry.candidates.some((c) => c.title) && !window.confirm("跳过会清除本奖项在草稿中的候选，继续吗？")) return;
            updateEntry({ ...entry, skipped: e.target.checked, candidates: [] });
          }} />跳过本项</label></div>
          <fieldset disabled={!canEdit || busy} className="space-y-4">
            {entry.skipped ? <p className="rounded-xl bg-white/5 p-6 text-sm text-slate-400">本项已跳过。你可以继续填写其他奖项。</p> : <>
              {entry.candidates.map((candidate, index) => <NomineeFields key={`${award.id}-${index}`} candidate={candidate} index={index} update={(next) => updateEntry({ ...entry, candidates: entry.candidates.map((c, i) => i === index ? next : c) })} remove={() => updateEntry({ ...entry, candidates: entry.candidates.filter((_, i) => i !== index) })} />)}
              {!entry.candidates.length && <p className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">谁让你记住了这一年？先添加一位候选。</p>}
              {entry.candidates.length < 3 && <AppButton variant="ghost" onClick={() => updateEntry({ ...entry, candidates: [...entry.candidates, emptyCandidate()] })}>添加候选（{entry.candidates.length}/3）</AppButton>}
            </>}
          </fieldset>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-sm text-slate-300">{!canEdit ? "征集已结束" : pendingSubmission ? "修改尚未提交，汇总仍使用上次版本" : dirty ? "有未保存的修改" : data.mine.submittedAt ? "已提交 · 已计入汇总" : data.mine.savedAt ? "草稿已保存 · 尚未提交" : "保存可稍后继续，提交后计入汇总"}</p>
            <div className="mt-3 flex flex-wrap gap-2"><AppButton disabled={busy || !canEdit} variant="ghost" onClick={() => save("save")}>{busy ? "处理中…" : "保存全部草稿"}</AppButton><AppButton disabled={busy || !canEdit} variant="primary" onClick={() => save("submit")}>确认提交整份提名</AppButton>
              {data.mine.submitted && <AppButton variant="quiet" onClick={() => download(`我的年度提名-${data.year}.json`, JSON.stringify({ event: data.title, submittedAt: data.mine.submittedAt, awards: data.awards, entries: data.mine.submitted }, null, 2), "application/json")}>下载已提交记录</AppButton>}</div>
          </div>
        </>}
        {tab === "published" && (data.status !== "PUBLISHED" ? <div className="py-10 text-center"><h3 className="text-lg font-semibold">正式入围尚未公布</h3><p className="mt-3 text-sm text-slate-400">填写页的群友候选用于互相提醒，正式入围名单由组织者确认后在这里公布。</p></div> : <><p className="mb-4 text-sm text-slate-400">本页是正式入围名单，最终获奖待现场投票或讨论决定。</p><div className="grid gap-3 sm:grid-cols-2">{published.map((candidate, index) => <div key={index} className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-5"><p className="text-xs text-amber-200">正式入围</p><h3 className="mt-2 break-words text-lg font-bold">{candidate.title}</h3>{candidate.workTitle && <p className="mt-1 break-words text-sm text-slate-400">{candidate.workTitle}</p>}{candidate.reference && <AwardReferencePreview reference={candidate.reference} />}</div>)}</div>{!published.length && <p className="py-8 text-center text-slate-400">本项暂未设入围</p>}</>)}
        {tab === "organizer" && data.organizer && <>
          <details className="mb-4 rounded-xl border border-rose-300/20 px-3 text-sm"><summary className="cursor-pointer py-3 text-rose-200">删除活动</summary><p className="mb-3 text-slate-300">永久删除本活动、所有人的提名和入围名单，无法恢复。</p><label className="block">输入活动名称确认：{data.title}<input className={field} value={deleteTitle} onChange={(e) => setDeleteTitle(e.target.value)} autoComplete="off" /></label><AppButton className="my-3 border-rose-300/30 text-rose-200" variant="ghost" disabled={busy || deleteTitle !== data.title} onClick={removeCeremony}>永久删除活动</AppButton></details>
          <p className="text-sm leading-6 text-slate-300">本项 {summary?.participantCount ?? 0} 人提名，{summary?.skippedCount ?? 0} 人跳过。数字代表提名人数，不是最终决选票数。</p>
          <p className="mt-2 text-xs leading-6 text-slate-400">关联同一 Bangumi 条目的候选按编号去重；纯手填候选按名称与所属作品核对，别名不会盲目合并。每项最多 12 位，公布前可保存草案。</p>
          <div className="my-4 flex flex-wrap gap-2"><AppButton variant="ghost" disabled={busy} onClick={exportSummary}>导出提名与素材 CSV</AppButton>{data.status === "OPEN" && <AppButton variant="secondary" disabled={busy} onClick={() => organize("freeze")}>结束征集，整理入围</AppButton>}</div>
          <div className="space-y-3">{summary?.candidates.slice((candidatePage - 1) * 6, candidatePage * 6).map((candidate) => <div key={candidate.key} className="rounded-xl border border-white/10 p-4">
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-4 w-4 shrink-0 accent-amber-300" disabled={busy || data.status !== "FROZEN"} checked={shortlist[award.id]?.includes(candidate.key) ?? false} onChange={(e) => {
              const current = shortlist[award.id] ?? [];
              if (e.target.checked && current.length >= 12) { setError("每项最多入围 12 位候选"); return; }
              setShortlist((old) => ({ ...old, [award.id]: e.target.checked ? [...current, candidate.key] : current.filter((key) => key !== candidate.key) })); setShortlistDirty(true);
            }} /><span className="min-w-0 flex-1 break-words"><strong>{candidate.title}</strong>{candidate.workTitle && <span className="mt-1 block text-xs text-slate-400">{candidate.workTitle}</span>}</span><span className="shrink-0 text-sm text-amber-200">{candidate.count} 人提名</span></label>
            {candidate.reference && <AwardReferencePreview reference={candidate.reference} />}
            <details className="mt-2 text-sm"><summary className="cursor-pointer py-2 text-slate-400">提名理由与播放素材</summary>{candidate.supporters.map((s, i) => <div key={i} className="mt-2 rounded-lg bg-white/5 p-3"><p className="text-xs text-slate-400">{s.name}</p><p className="mt-1 whitespace-pre-wrap break-words">{s.reason || "未填写理由"}</p>{s.mediaUrl && <a className="mt-2 inline-flex min-h-11 items-center text-amber-200 underline" target="_blank" rel="noopener noreferrer" href={s.mediaUrl}>打开素材链接 ↗</a>}</div>)}</details>
          </div>)}</div>
          {(summary?.candidates.length ?? 0) > 6 && <nav aria-label="候选翻页" className="mt-4 flex items-center justify-between gap-2"><AppButton variant="ghost" disabled={candidatePage === 1} onClick={() => setCandidatePage((p) => p - 1)}>上一页</AppButton><span className="text-xs text-slate-400">{candidatePage} / {Math.ceil((summary?.candidates.length ?? 0) / 6)}</span><AppButton variant="ghost" disabled={candidatePage * 6 >= (summary?.candidates.length ?? 0)} onClick={() => setCandidatePage((p) => p + 1)}>下一页</AppButton></nav>}
          {!summary?.candidates.length && <p className="py-8 text-center text-sm text-slate-400">本项还没有正式提交的提名。草稿不计入汇总。</p>}
          {data.status === "FROZEN" && <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-3 text-sm text-slate-400">本项已选 {shortlist[award.id]?.length ?? 0} 位入围 · {shortlistDirty ? "草案有未保存修改" : "公布后其他参与者才能看到"}</p><div className="flex flex-wrap gap-2"><AppButton disabled={busy} variant="ghost" onClick={() => organize("save")}>保存全部入围草案</AppButton><AppButton disabled={busy} variant="primary" onClick={() => organize("publish")}>公布本届入围名单</AppButton></div></div>}
          {data.status === "PUBLISHED" && <p className="mt-4 text-sm text-amber-200">入围已公布并固定。最终获奖尚未产生。</p>}
        </>}
      </section>
    </div>
  </div></PageShell>;
}

function NomineeFields({ candidate, index, update, remove }: { candidate: Nominee; index: number; update: (value: Nominee) => void; remove: () => void }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
    <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-amber-100">候选 {index + 1}</h3><AppButton variant="quiet" onClick={remove} aria-label={`移除候选 ${index + 1}`}>移除</AppButton></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">候选名称<input maxLength={150} readOnly={!!candidate.reference} className={field} placeholder="作品、角色、OP、单集或人员" value={candidate.title} onChange={(e) => update({ ...candidate, title: e.target.value })} /></label><label className="block text-sm">所属作品（选填）<input maxLength={150} className={field} placeholder="动画名（可留空）" value={candidate.workTitle} onChange={(e) => update({ ...candidate, workTitle: e.target.value })} /></label></div>
    {candidate.reference && <div className="mt-1 flex flex-wrap items-start gap-x-3"><AwardReferencePreview key={`${candidate.reference.kind}:${candidate.reference.id}`} reference={candidate.reference} /><details className="mt-2 text-xs text-slate-400"><summary className="inline-flex min-h-11 cursor-pointer items-center">修改关联</summary><AppButton variant="quiet" onClick={() => { const { reference: _reference, ...manual } = candidate; update(manual); }}>解除关联并手填</AppButton></details></div>}
    <details className="mt-3 text-sm"><summary className="cursor-pointer py-2 text-slate-400">理由与素材（选填）</summary><label className="mt-2 block">提名理由<textarea rows={2} maxLength={1000} className={field} value={candidate.reason} onChange={(e) => update({ ...candidate, reason: e.target.value })} /></label><label className="mt-3 block">OP / ED / MV / 片段链接<input type="url" maxLength={1000} className={field} placeholder="https://…" value={candidate.mediaUrl} onChange={(e) => update({ ...candidate, mediaUrl: e.target.value })} /></label><p className="mt-2 text-xs leading-5 text-slate-400">链接交给主持人准备素材；需要的播放时间点或剧透提醒可写在理由中。</p></details>
  </div>;
}
