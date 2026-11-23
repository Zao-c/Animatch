"use client";

import { useState } from "react";
import { AppButton } from "./ui/AppButton";
import type { AwardDefinition } from "@/lib/award-nominations";
import type { PublishedAward } from "@/lib/award-live-types";
import { advanceRehearsal, newRehearsal, type RehearsalAction, type RehearsalState } from "@/lib/award-rehearsal";

const box = "min-w-0 rounded-2xl border border-purple-300/20 bg-slate-950/40 p-4 sm:p-6";
const scenes = { NOMINEES: "入围展示", VOTING: "模拟投票中", CLOSED: "模拟票箱已关闭", READY: "模拟结果待揭晓", REVEALED: "模拟获奖揭晓" };
const methods = { VOTE: "模拟投票", DISCUSSION: "模拟讨论决定", WITHHELD: "模拟空缺" };

export function AwardRehearsal({ awards, published, initialAwardId, onExit }: {
  awards: AwardDefinition[];
  published: PublishedAward[];
  initialAwardId: string;
  onExit: () => void;
}) {
  const [selected, setSelected] = useState(initialAwardId || awards[0]?.id || "");
  const [states, setStates] = useState<Record<string, RehearsalState>>({});
  const [error, setError] = useState("");
  const [reason, setReason] = useState(""), [winnerKeys, setWinnerKeys] = useState<string[]>([]);
  const [method, setMethod] = useState<"DISCUSSION" | "WITHHELD">("DISCUSSION");
  const state = states[selected] ?? newRehearsal();
  const index = awards.findIndex((a) => a.id === selected), award = awards[index];
  const candidates = published.find((p) => p.awardId === selected)?.candidates ?? [];
  const round = state.rounds.at(-1);
  const voting = state.scene === "VOTING";
  const titleFor = (key: string) => candidates.find((c) => c.key === key)?.title ?? key;
  function select(id: string) { setSelected(id); setError(""); setReason(""); setWinnerKeys([]); }
  function act(action: RehearsalAction) {
    try { const next = advanceRehearsal(state, action, candidates.map((c) => c.key)); setStates((old) => ({ ...old, [selected]: next })); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "排练操作失败"); }
  }

  return <section aria-label="本机排练" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-300/40 bg-purple-300/10 p-4">
      <div><h2 className="text-lg font-bold text-purple-100">本机排练 · 模拟数据</h2><p className="mt-1 text-sm leading-6 text-slate-300">仅在此页面练习。退出或刷新后清空；正式现场与观众画面不变。</p></div>
      <AppButton onClick={onExit}>退出排练，返回主持台</AppButton>
    </div>
    {error && <p role="alert" className="rounded-xl border border-rose-300/30 p-3 text-rose-200">{error}</p>}
    <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className={box}>
        <label className="block text-sm font-semibold">排练奖项<select aria-label="排练奖项" className="anime-field mt-2 w-full min-w-0" value={selected} onChange={(e) => select(e.target.value)}>{awards.map((a, i) => <option key={a.id} value={a.id}>{i + 1}. {a.title}</option>)}</select></label>
        <div className="mt-3 grid grid-cols-2 gap-2"><AppButton disabled={index <= 0} onClick={() => select(awards[index - 1].id)}>上一项</AppButton><AppButton disabled={index < 0 || index === awards.length - 1} onClick={() => select(awards[index + 1].id)}>下一项</AppButton></div>
        <details className="mt-3 border-t border-white/10 pt-2"><summary className="cursor-pointer py-3 text-sm text-slate-300">排练说明与重置</summary>
        <p className="mt-2 text-sm leading-6 text-slate-400">用下面三个模拟席位试投票；选择不同候选可练习平票，全部弃权可练习空缺。</p>
        <AppButton variant="ghost" className="mt-4 w-full" onClick={() => { if (window.confirm("清空本奖项的模拟票数与结果？正式数据不受影响。")) { act({ type: "reset" }); setReason(""); setWinnerKeys([]); } }}>重置本项排练</AppButton>
        <p className="mt-3 text-xs text-slate-400">可随时重练，不需要创建测试活动。</p></details>
      </aside>
      <div className="min-w-0 space-y-4">
        <section className={`${box} bg-gradient-to-br from-purple-300/10 to-slate-950`}>
          <p className="text-xs font-bold tracking-widest text-purple-200">REHEARSAL · 非正式结果</p>
          <p role="status" className="mt-3 text-sm text-purple-100">{scenes[state.scene]}{round && ` · 第 ${state.rounds.length} 轮`}</p>
          <h2 className="mt-3 text-2xl font-black">{award?.title ?? "未设置奖项"}</h2>
          {state.scene === "REVEALED" && state.decision ? <div className="mt-5 rounded-xl border border-purple-200/30 p-5"><p className="text-sm text-purple-200">{methods[state.decision.method]}</p><p className="mt-3 break-words text-3xl font-black">{state.decision.keys.map(titleFor).join(" · ") || "本项空缺"}</p>{state.decision.reason && <p className="mt-3 whitespace-pre-wrap break-words text-slate-300">{state.decision.reason}</p>}</div>
            : <div className="mt-5 grid gap-3 sm:grid-cols-2">{candidates.filter((c) => !voting || round?.keys.includes(c.key)).map((c) => <div key={c.key} className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-4"><p className="break-words font-bold">{c.title}</p>{c.workTitle && <p className="mt-2 break-words text-sm text-slate-400">{c.workTitle}</p>}</div>)}{!candidates.length && <p className="text-sm text-slate-400">暂无入围，可练习空缺说明。</p>}</div>}
        </section>
        <section className={box}>
          <h2 className="font-bold">排练操作</h2>
          {!state.decision && <div className="mt-4 flex flex-wrap gap-2">
            <AppButton variant="primary" disabled={voting || !candidates.length || !!round?.tally?.leaders.length} onClick={() => act({ type: "open" })}>{round ? "重开模拟投票" : "开启模拟投票"}</AppButton>
            {voting && <AppButton onClick={() => act({ type: "close" })}>关闭模拟票箱</AppButton>}
            {(round?.tally?.leaders.length ?? 0) > 1 && <AppButton onClick={() => act({ type: "runoff" })}>模拟平票加赛</AppButton>}
          </div>}
          {voting && round && <fieldset className="mt-5 grid gap-3 sm:grid-cols-3"><legend className="mb-3 text-sm text-purple-200">模拟席位，不是真实用户选票</legend>{round.votes.map((vote, seat) => <label key={seat} className="min-w-0 text-sm">模拟席位 {seat + 1}<select aria-label={`模拟席位 ${seat + 1}`} className="anime-field mt-2 w-full min-w-0" value={vote === undefined ? "pending" : vote === null ? "abstain" : String(round.keys.indexOf(vote))} onChange={(e) => act({ type: "vote", seat, key: e.target.value === "pending" ? undefined : e.target.value === "abstain" ? null : round.keys[Number(e.target.value)] })}><option value="pending">尚未投票</option><option value="abstain">弃权</option>{round.keys.map((key, i) => <option key={key} value={i}>{titleFor(key)}</option>)}</select></label>)}</fieldset>}
          {round?.tally && <div className="mt-5 rounded-xl bg-white/5 p-4 text-sm"><p className="mb-2 text-purple-200">模拟计票 · {round.tally.voters} 票 · {round.tally.abstained} 票弃权</p>{round.keys.map((key) => <p key={key} className="flex justify-between gap-4 py-1"><span className="min-w-0 break-words">{titleFor(key)}</span><strong className="shrink-0">{round.tally!.counts[key]} 票</strong></p>)}</div>}
          {!voting && !state.decision && <div className="mt-4 space-y-4">
            {!!round?.tally?.leaders.length && <AppButton variant="primary" onClick={() => act({ type: "decide", method: "VOTE" })}>确认模拟投票结果</AppButton>}
            <details className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer py-2">练习讨论决定 / 空缺</summary>
              <label className="mt-3 block text-sm">模拟决定方式<select className="anime-field mt-2" value={method} onChange={(e) => { setMethod(e.target.value as typeof method); setWinnerKeys([]); }}><option value="DISCUSSION">讨论决定</option><option value="WITHHELD">本项空缺</option></select></label>
              {method === "DISCUSSION" && candidates.map((c) => <label key={c.key} className="mt-2 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={winnerKeys.includes(c.key)} onChange={(e) => setWinnerKeys((old) => e.target.checked ? [...old, c.key] : old.filter((key) => key !== c.key))} />{c.title}</label>)}
              <label className="mt-3 block text-sm">模拟结论或空缺原因<textarea className="anime-field mt-2" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              <AppButton className="mt-3" disabled={!reason.trim() || (method === "DISCUSSION" && !winnerKeys.length)} onClick={() => act({ type: "decide", method, keys: winnerKeys, reason })}>确认模拟讨论结论</AppButton>
            </details>
          </div>}
          {state.scene === "READY" && state.decision && <div className="mt-5"><p className="mb-3 break-words text-purple-100">模拟待揭晓：{state.decision.keys.map(titleFor).join(" / ") || "本项空缺"}</p><AppButton variant="primary" onClick={() => act({ type: "reveal" })}>模拟揭晓获奖</AppButton></div>}
          {state.scene === "REVEALED" && <p className="mt-4 text-sm text-purple-100">这一项排练完成。可选择下一项，或重置后再试。</p>}
          {state.rounds.length > 1 && <details className="mt-4 text-sm"><summary className="cursor-pointer py-2 text-slate-400">模拟历轮记录</summary>{state.rounds.map((r, i) => <p key={i} className="mt-2 break-words">第 {i + 1} 轮：{r.tally ? r.keys.map((key) => `${titleFor(key)} ${r.tally!.counts[key]} 票`).join(" / ") : "投票中"}</p>)}</details>}
        </section>
      </div>
    </div>
  </section>;
}
