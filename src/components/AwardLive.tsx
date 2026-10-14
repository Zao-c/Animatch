"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "./PageShell";
import { AppButton, appButtonClasses } from "./ui/AppButton";
import { featureRequest } from "@/lib/feature-api";
import { csvCell, referenceUrl, type SuggestedNominee } from "@/lib/award-nominations";
import type { getAwardLive } from "@/lib/award-live-service";

type Live = Awaited<ReturnType<typeof getAwardLive>>;
type Mode = "host" | "live" | "screen" | "results";
const box = "min-w-0 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-6";
const field = "anime-field mt-2 w-full min-w-0";
const sceneLabels: Record<string, string> = { WAITING: "等待主持人", NOMINEES: "入围展示", VOTING: "现场投票中", CLOSED: "票箱已关闭", READY: "等待揭晓", REVEALED: "获奖揭晓", FINISHED: "本届颁奖结束" };
const methodLabels: Record<string, string> = { VOTE: "现场投票", DISCUSSION: "讨论决定", WITHHELD: "本项空缺" };

export function AwardLive({ id, mode }: { id: string; mode: Mode }) {
  const root = `/ceremonies/${encodeURIComponent(id)}`, api = `/api/ceremonies/${encodeURIComponent(id)}`;
  const host = mode === "host", screen = mode === "screen";
  const [data, setData] = useState<Live | null>(null), [actionError, setError] = useState(""), [notice, setNotice] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const error = actionError || connectionError;
  const [selected, setSelected] = useState(""), [busy, setBusy] = useState(false), [method, setMethod] = useState("DISCUSSION"), [reason, setReason] = useState("");
  const [winnerKeys, setWinnerKeys] = useState<string[]>([]), [category, setCategory] = useState("全部"), [preview, setPreview] = useState(false);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const next = await featureRequest<Live>(`${api}/${host ? "host" : "live"}`);
      if (version !== requestVersion.current) return;
      setData(next); setConnectionError(""); setSelected((old) => old || next.stage.awardId || next.awards[0]?.id || "");
    } catch (e) { if (version === requestVersion.current) setConnectionError(e instanceof Error ? e.message : "连接中断，保留上次画面"); }
  }, [api, host]);
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const counter = requestVersion;
    const tick = async () => { await refresh(); if (!stopped) timer = setTimeout(tick, 4000); };
    void tick(); return () => { stopped = true; clearTimeout(timer); counter.current++; };
  }, [refresh]);
  useEffect(() => { setReason(""); setWinnerKeys([]); setNotice(""); }, [selected]);

  async function control(action: string, extra: Record<string, unknown> = {}) {
    if (!data || busy) return;
    const confirmations: Record<string, string> = { close: "关闭本轮票箱？关闭后不能改票。", decide: "确认这个结果？确认后将固定，下一步才向观众揭晓。", reveal: "正式向所有参与者揭晓？公布后不能撤回。", finish: "结束本届颁奖并保存为年度回顾？" };
    if (confirmations[action] && !window.confirm(confirmations[action])) return;
    setBusy(true); setError(""); setNotice("");
    try { await featureRequest(`${api}/host`, { method: "POST", body: JSON.stringify({ action, awardId: selected, revision: data.revision, ...extra }) }); setNotice("已更新现场状态"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "操作失败"); }
    finally { setBusy(false); }
  }
  async function vote(candidateKey: string | null) {
    if (!data || busy) return;
    const round = data.rounds.find((r) => r.status === "OPEN");
    if (!round) return;
    setBusy(true); setError("");
    try { await featureRequest(`${api}/live`, { method: "PUT", body: JSON.stringify({ roundId: round.id, revision: round.mine?.revision ?? 0, candidateKey }) }); setNotice(candidateKey === null ? "已记录弃权，关票前可以改选" : "选票已保存，关票前可以改选"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "投票失败"); }
    finally { setBusy(false); }
  }
  function exportResults() {
    if (!data) return;
    const rows = [["奖项", "产生方式", "获奖者", "说明", "揭晓时间"]];
    for (const d of data.decisions.filter((d) => d.revealedAt)) rows.push([data.awards.find((a) => a.id === d.awardId)?.title ?? "", methodLabels[d.method], d.winners.map((w) => w.title).join(" / "), d.reason, d.revealedAt!]);
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${data.year}-年度获奖记录.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!data) return <PageShell><div className={box}><h1 className="text-xl font-bold">{error ? "暂时无法进入现场" : "正在连接现场…"}</h1>{error && <p role="alert" className="mt-4 text-rose-200">{error}</p>}<div className="mt-4 flex flex-wrap gap-2"><Link className={appButtonClasses()} href={`${root}`}>返回活动 / 申请加入</Link><Link className={appButtonClasses({ variant: "ghost" })} href={`/login?next=${encodeURIComponent(`${root}/${mode}`)}`}>登录</Link><AppButton onClick={refresh}>重试</AppButton></div></div></PageShell>;

  const awardId = host ? selected : data.stage.awardId;
  const award = data.awards.find((a) => a.id === awardId);
  const candidates = data.published.find((a) => a.awardId === awardId)?.candidates ?? [];
  const rounds = data.rounds.filter((r) => r.awardId === awardId), round = rounds.at(-1);
  const decision = data.decisions.find((d) => d.awardId === awardId);
  const active = data.rounds.find((r) => r.status === "OPEN");
  const revealed = data.decisions.filter((d) => d.revealedAt);
  const canVote = mode === "live" && round?.status === "OPEN" && data.status === "LIVE";
  const scene = preview ? "NOMINEES" : data.stage.scene;

  const stage = <section className={`${box} ${screen ? "flex min-h-[85vh] flex-col justify-center bg-gradient-to-br from-amber-200/10 via-slate-950 to-slate-900 p-6 sm:aspect-video sm:min-h-0 sm:p-12" : ""}`}>
    <p className="text-xs font-bold tracking-[0.2em] text-amber-200">{data.year} ANIMATCH AWARDS {preview && "· 本机排练"}</p>
    <p className="mt-3 text-sm text-slate-300">{sceneLabels[scene]}{round && ` · 第 ${round.number} 轮`}</p>
    <h1 className={`mt-3 font-black ${screen ? "text-3xl sm:text-5xl" : "text-2xl"}`}>{award?.title ?? data.title}</h1>
    {decision?.revealedAt && !preview ? <div className="mt-6 rounded-2xl border border-amber-200/40 bg-amber-200/10 p-6"><p className="text-sm text-amber-200">{methodLabels[decision.method]}</p><p className="mt-3 break-words text-3xl font-black sm:text-4xl">{decision.winners.map((w) => w.title).join(" · ") || "本项空缺"}</p>{decision.reason && <p className="mt-4 whitespace-pre-wrap break-words text-slate-200">{decision.reason}</p>}</div>
      : scene === "WAITING" || scene === "FINISHED" ? <p className="mt-8 text-lg text-slate-300">{scene === "FINISHED" ? "谢谢你们一起留下这一年的记忆。" : "准备好，一起回顾这一年的喜欢。"}</p>
      : <div className={`mt-6 grid gap-3 ${screen ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{(round?.status === "OPEN" ? round.candidates : candidates).map((c) => <Candidate key={c.key} candidate={c} selected={canVote && round?.mine?.candidateKey === c.key} onChoose={canVote ? () => vote(c.key) : undefined} disabled={busy} />)}{!candidates.length && <p className="text-slate-400">本项未设入围，等待主持人说明。</p>}</div>}
    {round?.status === "OPEN" && <p className="mt-5 text-sm text-slate-300">{round.total} 人已提交 · 票数在揭晓后公开</p>}
    {canVote && <div className="mt-4 flex flex-wrap items-center gap-3"><AppButton variant="ghost" disabled={busy} onClick={() => vote(null)}>本轮弃权</AppButton><p className="text-sm text-amber-100">{round?.mine ? round.mine.candidateKey === null ? "你已弃权" : "你已投票，点击其他候选可改选" : "点选你支持的候选"}</p></div>}
  </section>;

  if (screen) return <main className="min-h-screen bg-slate-950 p-3 text-white sm:p-6"><div className="mx-auto max-w-[100rem]">{stage}{error && <p role="alert" className="mt-3 text-amber-200">连接中断，显示上次同步画面。{error}</p>}<Link href={`${root}/live`} className="mt-3 inline-flex min-h-11 items-center text-sm text-slate-400">退出展示屏</Link></div></main>;
  return <PageShell><div className="mx-auto max-w-6xl">
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><Link href={root} className="text-sm text-slate-400">← {data.title}</Link><h1 className="mt-2 text-2xl font-black">{host ? "主持颁奖" : mode === "results" ? "年度回顾" : "颁奖现场"}</h1><p className="mt-2 text-sm text-slate-400">已揭晓 {revealed.length} / {data.awards.length} 项</p></div><div className="flex flex-wrap gap-2"><Link className={appButtonClasses({ variant: "ghost" })} href={`${root}/live`}>现场投票</Link><Link className={appButtonClasses({ variant: "ghost" })} href={`${root}/results`}>年度回顾</Link>{data.isOwner && <Link className={appButtonClasses({ variant: "secondary" })} href={`${root}/host`}>主持台</Link>}</div></header>
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-300/30 p-3 text-rose-200">{error} <AppButton variant="quiet" onClick={refresh}>刷新</AppButton></p>}{notice && <p role="status" className="mb-4 text-emerald-200">{notice}</p>}
    {mode === "results" ? <section className={box}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><label className="text-sm">奖项类别<select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>{["全部", ...new Set(data.awards.map((a) => a.category))].map((c) => <option key={c}>{c}</option>)}</select></label><AppButton variant="ghost" onClick={exportResults}>导出已揭晓奖单</AppButton></div>
      {!revealed.length && <p className="py-12 text-center text-slate-400">尚未揭晓，结果会在主持人公布后出现在这里。</p>}
      <div className="grid gap-4 sm:grid-cols-2">{data.awards.filter((a) => category === "全部" || a.category === category).map((a) => {
        const d = revealed.find((item) => item.awardId === a.id); if (!d) return null;
        return <article key={a.id} className="rounded-xl border border-amber-200/20 p-5"><p className="text-xs text-amber-200">{a.category} · {methodLabels[d.method]}</p><h2 className="mt-2 text-xl font-bold">{a.title}</h2><p className="mt-4 break-words text-lg text-amber-100">{d.winners.map((w) => w.title).join(" / ") || "本项空缺"}</p>{d.reason && <p className="mt-3 break-words text-sm text-slate-300">{d.reason}</p>}<details className="mt-4 text-sm"><summary className="cursor-pointer py-2 text-slate-400">入围与历轮记录</summary><p className="mt-2">{data.published.find((p) => p.awardId === a.id)?.candidates.map((c) => c.title).join("、") || "无入围"}</p>{data.rounds.filter((r) => r.awardId === a.id && r.tally).map((r) => <div className="mt-3 border-t border-white/10 pt-3" key={r.id}>第 {r.number} 轮 · {r.tally!.voters} 人参与 · {r.tally!.abstained} 人弃权{r.candidates.map((c) => <p className="mt-1" key={c.key}>{c.title}：{r.tally!.counts[c.key]} 票</p>)}</div>)}</details></article>;
      })}</div></section> : host ? <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className={box}><h2 className="font-bold">节目单</h2><label className="mt-3 block text-sm">选择奖项<select className={field} value={selected} onChange={(e) => setSelected(e.target.value)}>{data.awards.map((a, i) => <option key={a.id} value={a.id}>{i + 1}. {a.title}{revealed.some((d) => d.awardId === a.id) ? " · 已揭晓" : ""}</option>)}</select></label><p className="mt-3 text-xs leading-6 text-slate-400">选择只用于准备；点击“推送入围”才切换观众画面。</p><div className="mt-3 grid gap-2"><AppButton disabled={busy || (!!active && active.awardId !== selected)} onClick={() => control("show")}>推送入围 / 已揭晓结果</AppButton><AppButton variant="ghost" disabled={busy || !!active} onClick={() => control("wait")}>切换等待画面</AppButton><Link target="_blank" className={appButtonClasses({ variant: "ghost" })} href={`${root}/screen`}>打开直播展示屏 ↗</Link><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />本机预览入围</label></div><p className="mt-3 text-xs text-amber-200">观众正在看：{data.awards.find((a) => a.id === data.stage.awardId)?.title ?? "等待画面"}</p><AppButton className="mt-5" variant="quiet" disabled={busy || data.status === "COMPLETED" || revealed.length !== data.awards.length} onClick={() => control("finish")}>结束本届颁奖</AppButton></aside>
      <div className="min-w-0 space-y-4">{stage}<section className={box}><h2 className="text-lg font-bold">现场控制</h2>{preview && <p className="mt-2 text-sm text-amber-200">预览不更改观众画面。关闭预览后才能执行正式操作。</p>}<fieldset disabled={busy || preview || data.status === "COMPLETED"} className="mt-4 space-y-4">
        {!decision && <div className="flex flex-wrap gap-2"><AppButton variant="primary" disabled={!!active || !candidates.length || !!round?.tally?.leaders.length} onClick={() => control("open")}>{round?.status === "OPEN" ? "本轮投票中" : round ? "重新开一轮（上一轮无有效票）" : "开启本奖投票"}</AppButton>{round?.status === "OPEN" && <AppButton variant="secondary" onClick={() => control("close", { roundId: round.id })}>关闭本轮票箱</AppButton>}{round?.status === "CLOSED" && (round.tally?.leaders.length ?? 0) > 1 && <AppButton disabled={!!active} onClick={() => control("runoff")}>并列候选加赛</AppButton>}</div>}
        {round?.tally && <div className="rounded-xl bg-white/5 p-4 text-sm"><p className="mb-2 text-slate-400">第 {round.number} 轮 · {round.tally.voters} 人参与 · {round.tally.abstained} 人弃权 · 仅主持人可提前看</p>{round.candidates.map((c) => <p key={c.key} className="flex justify-between gap-4 py-1"><span>{c.title}</span><strong>{round.tally!.counts[c.key]} 票</strong></p>)}</div>}
        {!decision && !active && <><div className="flex flex-wrap gap-2">{round?.tally?.leaders.length ? <AppButton variant="primary" onClick={() => control("decide", { method: "VOTE", roundId: round.id })}>{round.tally.leaders.length > 1 ? "确认并列获奖" : "确认投票结果"}</AppButton> : null}</div><details className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer py-2">讨论决定 / 本项空缺</summary><label className="mt-3 block text-sm">决定方式<select className={field} value={method} onChange={(e) => { setMethod(e.target.value); setWinnerKeys([]); }}><option value="DISCUSSION">讨论决定</option><option value="WITHHELD">本项空缺</option></select></label>{method === "DISCUSSION" && <div className="mt-3">{candidates.map((c) => <label key={c.key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={winnerKeys.includes(c.key)} onChange={(e) => setWinnerKeys((old) => e.target.checked ? [...old, c.key] : old.filter((k) => k !== c.key))} />{c.title}</label>)}</div>}<label className="mt-3 block text-sm">结论与理由（必填）<textarea className={field} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></label><AppButton className="mt-3" disabled={!reason.trim() || (method === "DISCUSSION" && !winnerKeys.length)} onClick={() => control("decide", { method, winnerKeys, reason })}>确认讨论结论</AppButton></details></>}
        {decision && !decision.revealedAt && <div className="rounded-xl border border-amber-200/30 p-4"><p className="text-sm text-amber-100">待揭晓 · {methodLabels[decision.method]}</p><p className="my-3 text-xl font-bold">{decision.winners.map((w) => w.title).join(" / ") || "本项空缺"}</p><AppButton variant="primary" disabled={!!active} onClick={() => control("reveal")}>正式揭晓获奖</AppButton></div>}
        {decision?.revealedAt && <AppButton onClick={() => setSelected(data.awards[Math.min(data.awards.findIndex((a) => a.id === selected) + 1, data.awards.length - 1)].id)}>准备下一奖项 →</AppButton>}
      </fieldset></section><details className={box}><summary className="cursor-pointer font-semibold">主持素材与操作记录</summary><div className="mt-4 space-y-3">{data.materials.filter((m) => m.awardId === selected && (m.reason || m.mediaUrl)).map((m, i) => <div key={i} className="rounded-lg bg-white/5 p-3 text-sm"><strong>{m.title}</strong><p className="mt-2 whitespace-pre-wrap break-words text-slate-300">{m.reason}</p>{m.mediaUrl && <a target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-amber-200" href={m.mediaUrl}>打开播放素材 ↗</a>}</div>)}<details><summary className="cursor-pointer py-3 text-sm text-slate-400">最近操作</summary>{data.history.slice(0, 15).map((h, i) => <p className="py-1 text-xs text-slate-400" key={i}>{new Date(h.createdAt).toLocaleString("zh-CN")} · {h.action}</p>)}</details></div></details></div>
    </div> : stage}
  </div></PageShell>;
}

function Candidate({ candidate: c, selected, onChoose, disabled }: { candidate: SuggestedNominee; selected?: boolean; onChoose?: () => void; disabled?: boolean }) {
  const content = <><p className="break-words text-lg font-bold">{c.title}</p>{c.workTitle && <p className="mt-2 break-words text-sm text-slate-300">{c.workTitle}</p>}{onChoose && <p className="mt-4 text-sm text-amber-200">{selected ? "✓ 你当前的选择" : "投给这位候选"}</p>}</>;
  return onChoose ? <button type="button" disabled={disabled} aria-pressed={selected} onClick={onChoose} className={`min-h-32 rounded-xl border p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${selected ? "border-amber-200 bg-amber-200/15" : "border-white/15 bg-white/5 hover:border-amber-200/50"}`}>{content}</button>
    : <article className="min-h-28 rounded-xl border border-white/15 bg-white/5 p-5">{content}{c.reference && <a className="mt-3 inline-flex min-h-11 items-center text-xs text-amber-200" href={referenceUrl(c.reference)} target="_blank" rel="noopener noreferrer">Bangumi 资料 ↗</a>}</article>;
}
