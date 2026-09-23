"use client";

import { useState } from "react";
import { nicheRanking } from "@/lib/ranking-evidence";
import { CollectionPager } from "./ui/CollectionPager";
import { AnimeCover } from "./AnimeCover";

interface EvidenceItem {
  animeId: string; title: string; imageUrl: string | null; participantCount: number;
  averageRating?: number | null; averageElo?: number | null;
  ratingDeviation?: number | null; coverage?: number; sampleLabel?: string;
}

export function EvidenceLabel({ item }: { item: Pick<EvidenceItem, "participantCount" | "ratingDeviation" | "coverage"> }) {
  return <span className="text-xs leading-5 text-slate-400">{item.participantCount} 位独立评价者{item.participantCount > 0 && item.participantCount < 10 ? " · 小样本" : ""}{item.coverage !== undefined ? ` · 覆盖 ${item.coverage}%` : ""}{item.ratingDeviation != null ? ` · 评分离散度 ${item.ratingDeviation}` : ""}</span>;
}

export function RankingEvidencePanel({ items, season = false }: { items: EvidenceItem[]; season?: boolean }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const niche = nicheRanking(items);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(niche.length / 6)));
  return <section className="my-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] p-3 sm:p-4" aria-label="榜单样本说明">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-cyan-100">喜欢的程度，与支持的人数</h3><p className="mt-1 text-xs leading-6 text-slate-400">少于 10 位评价者标记为小样本；票数不等于人数。{season ? "私心票保留加成，但不会增加独立评价人数。" : "每位用户对同一作品只贡献一个评价。"}</p></div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-h-11 shrink-0 rounded-xl border border-cyan-300/25 px-3 text-sm font-semibold text-cyan-100">{open ? "收起小众发现" : `小众高口碑 · ${niche.length}`}</button></div>
    <details className="mt-1 text-xs text-slate-400"><summary className="min-h-11 cursor-pointer py-3">如何理解这些数字</summary><p className="leading-6">覆盖率是评价这部作品的人数占本榜有效参与者的比例。离散度越高，个人 Elo 的差异越大，不能直接理解为作品质量差。正式榜沿用现有计分；小众发现展示 3–9 位评价者、平均 Elo 高于初始值的作品，按平均 Elo 排列，不代表已形成社区共识。</p></details>
    {open && <div className="mt-3">{!niche.length ? <p className="py-3 text-sm text-slate-400">暂时没有符合条件的小众作品。</p> : <><div className="grid gap-3 md:grid-cols-2">{niche.slice((currentPage - 1) * 6, currentPage * 6).map((item) => <article key={item.animeId} className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-950/60 p-3"><AnimeCover src={item.imageUrl} title={item.title} size="sm" className="h-16 w-12 shrink-0" /><div className="min-w-0"><h4 className="line-clamp-2 text-sm font-semibold">{item.title}</h4><p className="mt-1 text-xs text-amber-200">平均 {Math.round(item.averageRating ?? item.averageElo ?? 1500)} Elo</p><EvidenceLabel item={item} /></div></article>)}</div><div className="mt-3"><CollectionPager label="小众作品" page={currentPage} pageSize={6} total={niche.length} onChange={setPage} /></div></>}</div>}
  </section>;
}
