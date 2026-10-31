"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { songRequest } from "@/lib/anisong/client";
import type { SongBoardView } from "@/lib/anisong/types";
export type TemplatePublishResult = { board: SongBoardView; template: { id: string; revision: number }; poolCount: number; itunesCount: number; warnings: { trackId: string; title: string; message: string }[] };
export function SongTemplatePublisher({ board, disabled, onPublish }: { board: SongBoardView; disabled: boolean; onPublish: (confirmed: boolean) => Promise<TemplatePublishResult | null> }) {
  const [confirmed, setConfirmed] = useState(false), [publishing, setPublishing] = useState(false);
  const [template, setTemplate] = useState<{ id: string; active: boolean; revision: number } | null>(null);
  const [result, setResult] = useState<TemplatePublishResult | null>(null);
  useEffect(() => { let alive = true; songRequest<typeof template>(`/api/anisong/boards/${board.id}/template`).then(value => { if (alive) setTemplate(value); }).catch(() => {}); return () => { alive = false; }; }, [board.id]);
  const count = board.document.candidateIds === null ? board.document.tracks.length : board.document.candidateIds.length;
  return <section className="space-y-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{template ? "更新公共曲单" : "发布公共曲单"}</h2><p className="mt-1 max-w-2xl text-xs leading-6 text-slate-400">发布当前参赛范围的 {count} 首歌。可用音频会保存到公共池并去重，大家无需网易云账号即可复用；每个人单独保存对决与分档。</p></div>{template && <Link className="text-xs text-anime-cyan underline" href={`/anisong/templates/${template.id}`}>查看公共曲单 · v{template.revision}</Link>}</div>
    <label className="flex items-start gap-2 text-xs leading-6 text-slate-300"><input type="checkbox" checked={confirmed} disabled={disabled || publishing} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-teal-300" />我确认有权将这些音频公开供他人试听和复用。</label>
    <div className="flex flex-wrap items-center gap-3"><AppButton disabled={disabled || publishing || !confirmed || count < 2} onClick={async () => { setPublishing(true); try { const value = await onPublish(confirmed); if (value) { setResult(value); setTemplate({ ...value.template, active: true }); } } finally { setPublishing(false); } }}>{publishing ? "正在保存音频并发布…" : template ? "更新公共曲单" : "发布到公共曲单"}</AppButton><p className="text-xs text-slate-500">公共版本不包含你的投票；更新后，已有玩家的进度和曲目版本会保留。</p></div>
    {publishing && <p role="status" className="text-xs text-cyan-200">逐首检查并保存音频，文件较多时可能需要一些时间，请保持页面打开。</p>}
    {result && <div className="space-y-2 text-xs"><p role="status" className="text-anime-cyan">已发布：{result.poolCount} 首公共音频 · {result.itunesCount} 首已匹配 iTunes · {result.warnings.length} 首需要补充</p>{result.warnings.length > 0 && <ul className="max-h-44 space-y-1 overflow-auto text-amber-200">{result.warnings.map(warning => <li key={warning.trackId}>{warning.title}：{warning.message}</li>)}</ul>}</div>}
  </section>;
}
