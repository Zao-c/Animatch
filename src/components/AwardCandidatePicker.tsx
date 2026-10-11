"use client";

import { useEffect, useState } from "react";
import { AppButton, appButtonClasses } from "./ui/AppButton";
import { nomineeKey, normalizeNomineeText, referenceKindForAward, referenceUrl, type AwardDefinition, type Nominee, type NomineeReference, type SuggestedNominee } from "@/lib/award-nominations";
import { featureRequest } from "@/lib/feature-api";
import type { ReferenceCard, ReferenceDetail } from "@/lib/award-reference-types";

const field = "min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-base text-white";
export function AwardCandidatePicker({ ceremonyId, award, initial, selected, disabled, onChoose }: {
  ceremonyId: string; award: AwardDefinition; initial: SuggestedNominee[]; selected: Nominee[]; disabled: boolean; onChoose: (candidate: Nominee) => void;
}) {
  const [suggestions, setSuggestions] = useState(initial), [refreshing, setRefreshing] = useState(false), [suggestionError, setSuggestionError] = useState("");
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [searchError, setSearchError] = useState(""), [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReferenceCard[]>([]), [credits, setCredits] = useState<ReferenceCard[] | null>(null), [sourceTitle, setSourceTitle] = useState("");
  const [mode, setMode] = useState<"name" | "work">("name"), [creditQuery, setCreditQuery] = useState(""), [page, setPage] = useState(1);
  const kind = referenceKindForAward(award), targetKind = kind ?? "subject";
  const selectedKeys = new Set(selected.map(nomineeKey));
  useEffect(() => setSuggestions(initial), [initial]);
  useEffect(() => { setResults([]); setCredits(null); setSearchError(""); setPage(1); }, [mode]);
  async function refresh() {
    setRefreshing(true); setSuggestionError("");
    try {
      const next = await featureRequest<{ awardId: string; candidates: SuggestedNominee[] }[]>(`/api/ceremonies/${ceremonyId}/suggestions`);
      setSuggestions(next.find((s) => s.awardId === award.id)?.candidates ?? []);
    } catch (e) { setSuggestionError(e instanceof Error ? e.message : "候选更新失败"); } finally { setRefreshing(false); }
  }
  function choose(candidate: Pick<Nominee, "title" | "workTitle" | "reference">) {
    if (disabled || selectedKeys.has(nomineeKey(candidate))) return;
    onChoose({ ...candidate, reason: "", mediaUrl: "" }); setOpen(false);
  }
  async function search() {
    setLoading(true); setSearchError(""); setResults([]); setCredits(null); setPage(1);
    try {
      const searchKind = mode === "work" ? "subject" : targetKind;
      const result = await featureRequest<ReferenceCard[]>(`/api/award-references?kind=${searchKind}&q=${encodeURIComponent(query.trim())}&music=${award.category === "音乐" && mode === "name"}`);
      setResults(result);
      if (!result.length) setSearchError("没有找到匹配资料，可试试日文名、简称，或保留手动填写。");
    } catch (e) { setSearchError(e instanceof Error ? e.message : "查询失败"); } finally { setLoading(false); }
  }
  async function findCredits(work: ReferenceCard) {
    setLoading(true); setSearchError(""); setCreditQuery(""); setPage(1);
    try { setCredits(await featureRequest<ReferenceCard[]>(`/api/award-references?mode=credits&kind=${targetKind}&id=${work.reference.id}`)); setSourceTitle(work.title); }
    catch (e) { setSearchError(e instanceof Error ? e.message : "制作资料加载失败"); } finally { setLoading(false); }
  }
  const shown = (credits ?? results).filter((c) => !credits || normalizeNomineeText(`${c.title} ${c.subtitle} ${c.role}`).includes(normalizeNomineeText(creditQuery)));
  return <section aria-label="候选提示与资料" className="mb-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
    <div className="flex flex-wrap items-center gap-2"><label className="min-w-0 flex-1"><span className="sr-only">选择群友已提名的候选</span><select className={field} value="" disabled={disabled || !suggestions.length} onChange={(e) => { const candidate = suggestions.find((s) => s.key === e.target.value); if (candidate) choose(candidate); }}><option value="">{suggestions.length ? `群友已提名（${suggestions.length}）` : "暂无群友候选"}</option>{suggestions.map((candidate) => <option key={candidate.key} value={candidate.key} disabled={selectedKeys.has(candidate.key)}>{candidate.title}{candidate.workTitle ? ` · ${candidate.workTitle}` : ""}{selectedKeys.has(candidate.key) ? "（已添加）" : ""}</option>)}</select></label>
      <AppButton variant="quiet" disabled={refreshing} onClick={refresh}>{refreshing ? "更新中…" : "更新候选"}</AppButton>
      <AppButton variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "收起查询" : "查 Bangumi"}</AppButton></div>
    {suggestionError && <p role="alert" className="mt-2 text-sm text-rose-200">{suggestionError}</p>}
    {open && <div className="mt-4 border-t border-white/10 pt-4">
      <p className="mb-3 text-sm leading-6 text-slate-300">{kind === "person" ? "按名字搜索，或从熟悉的作品找制作人员。" : kind === "character" ? "按名字搜索，或从作品角色表选择。" : !kind ? "单集、CP、歌曲和片段请手填具体名称；这里可查相关资料。" : "选择条目即可添加，自动合并不同译名。"}</p>
      {(kind === "person" || kind === "character") && <div className="mb-3 flex gap-2"><AppButton disabled={loading} variant={mode === "name" ? "secondary" : "quiet"} onClick={() => setMode("name")}>按名字找</AppButton><AppButton disabled={loading} variant={mode === "work" ? "secondary" : "quiet"} onClick={() => setMode("work")}>从作品找{kind === "person" ? "制作人员" : "角色"}</AppButton></div>}
      <div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">资料查询关键词</span><input className={field} maxLength={100} value={query} placeholder={mode === "work" ? "输入你熟悉的动画名" : "中文名、日文名或简称"} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !loading && query.trim().length >= 2) { e.preventDefault(); void search(); } }} /></label><AppButton onClick={search} disabled={loading || query.trim().length < 2}>{loading ? "查询中…" : "查询"}</AppButton></div>
      {searchError && <p role="alert" className="mt-3 text-sm text-rose-200">{searchError}</p>}
      {credits && <div className="mt-4"><p className="mb-2 text-sm text-amber-100">《{sourceTitle}》的{kind === "person" ? "制作人员" : "角色"}</p><label className="block text-sm">筛选名字或职务<input className={`${field} mt-1`} value={creditQuery} placeholder="例如：监督、脚本、系列构成" onChange={(e) => { setCreditQuery(e.target.value); setPage(1); }} /></label></div>}
      <div className="mt-3 space-y-3">{shown.slice((page - 1) * 5, page * 5).map((card) => <article key={`${card.reference.kind}:${card.reference.id}`} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><h4 className="break-words font-semibold">{card.title}</h4>{card.subtitle && <p className="mt-1 break-words text-xs text-slate-400">{card.subtitle}</p>}{card.role && <p className="mt-1 text-xs text-amber-200">{card.role}</p>}</div>
          {mode === "work" && !credits ? <AppButton disabled={loading} variant="secondary" onClick={() => findCredits(card)}>查看{kind === "person" ? "制作人员" : "角色"}</AppButton> : kind && <AppButton variant="secondary" disabled={disabled || selectedKeys.has(nomineeKey({ title: card.title, workTitle: "", reference: card.reference }))} onClick={() => choose({ title: card.title, workTitle: credits ? sourceTitle : "", reference: card.reference })}>{selectedKeys.has(nomineeKey({ title: card.title, workTitle: "", reference: card.reference })) ? "已添加" : "选为候选"}</AppButton>}
        </div>
        {card.aliases.length > 0 && <p className="mt-2 line-clamp-2 text-xs text-slate-400">别名：{card.aliases.join(" / ")}</p>}
        <AwardReferencePreview reference={card.reference} />
      </article>)}</div>
      {credits && !shown.length && <p className="mt-3 text-sm text-slate-400">没有匹配记录；可清除职务筛选或到 Bangumi 查看完整资料。</p>}
      {shown.length > 5 && <div className="mt-3 flex items-center justify-between"><AppButton variant="quiet" disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</AppButton><span className="text-xs text-slate-400">{page} / {Math.ceil(shown.length / 5)}</span><AppButton variant="quiet" disabled={page * 5 >= shown.length} onClick={() => setPage(page + 1)}>下一页</AppButton></div>}
      <p className="mt-3 text-xs text-slate-500">资料来自 Bangumi；职务和关联作品供回忆与核对，是否符合本届奖项由参与者与组织者确认。</p>
    </div>}
  </section>;
}

export function AwardReferencePreview({ reference }: { reference: NomineeReference }) {
  const [open, setOpen] = useState(false), [detail, setDetail] = useState<ReferenceDetail | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [page, setPage] = useState(1);
  async function expand() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (detail) return;
    await loadDetails();
  }
  async function loadDetails() {
    setBusy(true); setError("");
    try { setDetail(await featureRequest<ReferenceDetail>(`/api/award-references?mode=detail&kind=${reference.kind}&id=${reference.id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "资料加载失败"); } finally { setBusy(false); }
  }
  return <div className="mt-2"><div className="flex flex-wrap gap-2"><AppButton variant="quiet" disabled={busy} aria-expanded={open} onClick={expand}>{busy ? "资料加载中…" : open ? "收起资料" : reference.kind === "person" ? "简介与履历" : "查看资料"}</AppButton><a className={appButtonClasses({ variant: "quiet" })} href={referenceUrl(reference)} target="_blank" rel="noopener noreferrer">Bangumi ↗</a></div>
    {open && <div className="mt-2 rounded-xl bg-white/5 p-3">{error && <p role="alert" className="text-sm text-rose-200">{error}，也可以打开旁边的资料页。</p>}{detail && <><p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{detail.card.summary || "暂未提供简介，可到 Bangumi 查看。"}</p>
      {detail.worksUnavailable && <div className="mt-2"><p className="text-xs text-amber-200">关联作品暂未加载成功，可重试或到 Bangumi 查看完整履历。</p><AppButton variant="quiet" disabled={busy} onClick={loadDetails}>重新加载履历</AppButton></div>}
      {detail.works.length > 0 && <><h5 className="mt-3 text-sm font-semibold">参与 / 关联动画</h5><ul className="mt-2 grid gap-2 sm:grid-cols-2">{detail.works.slice((page - 1) * 6, page * 6).map((work) => <li key={work.id}><a className="block min-h-11 rounded-lg border border-white/10 p-2 text-sm text-slate-200 hover:border-amber-200/30" href={`https://bgm.tv/subject/${work.id}`} target="_blank" rel="noopener noreferrer">{work.title} ↗<span className="block text-xs text-slate-400">{work.role}</span></a></li>)}</ul>
        {detail.works.length > 6 && <div className="mt-2 flex items-center justify-between"><AppButton variant="quiet" disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</AppButton><span className="text-xs text-slate-400">{page} / {Math.ceil(detail.works.length / 6)}</span><AppButton variant="quiet" disabled={page * 6 >= detail.works.length} onClick={() => setPage(page + 1)}>下一页</AppButton></div>}</>}
    </>}</div>}
  </div>;
}
