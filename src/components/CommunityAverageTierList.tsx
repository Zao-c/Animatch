"use client";

import React from "react";
import { AnimeCover } from "./AnimeCover";
import { AppBadge } from "./ui/AppBadge";
import type { CommunityRankingResponse, CommunityRankingItem } from "@/lib/client-api";
import { DEFAULT_TIER_CONFIG, type TierRowConfig } from "@/lib/tier-config";

const DEFAULT_FIVE_PERCENTILE_CUTOFFS = [0.1, 0.3, 0.6, 0.85];

function percentileBuckets(items: CommunityRankingItem[], rows: TierRowConfig[]) {
  const sufficient = items.filter((i) => !i.insufficientSample);
  const sorted = [...sufficient].sort(
    (a, b) => (b.communityScore ?? 0) - (a.communityScore ?? 0)
  );
  const n = sorted.length;

  const emptyBuckets: Record<string, CommunityRankingItem[]> = {};
  for (const row of rows) {
    emptyBuckets[row.id] = [];
  }

  if (n === 0) {
    return { buckets: emptyBuckets, insufficient: items };
  }

  if (n <= 3) {
    emptyBuckets[rows[0].id] = sorted.slice(0, 1);
    for (let i = 1; i < rows.length && i < n; i++) {
      emptyBuckets[rows[i].id] = [sorted[i]];
    }
    const remaining = sorted.slice(rows.length > 0 ? Math.min(rows.length, n) : 0);
    if (remaining.length > 0 && rows.length > 0) {
      emptyBuckets[rows[rows.length - 1].id].push(...remaining);
    }
    return { buckets: emptyBuckets, insufficient: items.filter((i) => i.insufficientSample) };
  }

  if (n <= 7) {
    const top20 = Math.ceil(n * 0.2);
    const top50 = Math.ceil(n * 0.5);
    const top80 = Math.ceil(n * 0.8);
    if (rows.length >= 1) emptyBuckets[rows[0].id] = sorted.slice(0, top20);
    if (rows.length >= 2) emptyBuckets[rows[1].id] = sorted.slice(top20, top50);
    if (rows.length >= 3) emptyBuckets[rows[2].id] = sorted.slice(top50, top80);
    if (rows.length >= 4) emptyBuckets[rows[3].id] = sorted.slice(top80);
    return { buckets: emptyBuckets, insufficient: items.filter((i) => i.insufficientSample) };
  }

  if (rows.length === 5 && n > 7) {
    const sEnd = Math.max(1, Math.round(n * 0.1));
    const aEnd = Math.max(sEnd + 1, Math.round(n * 0.3));
    const bEnd = Math.max(aEnd + 1, Math.round(n * 0.6));
    const cEnd = Math.max(bEnd + 1, Math.round(n * 0.85));
    emptyBuckets[rows[0].id] = sorted.slice(0, sEnd);
    if (rows.length >= 2) emptyBuckets[rows[1].id] = sorted.slice(sEnd, aEnd);
    if (rows.length >= 3) emptyBuckets[rows[2].id] = sorted.slice(aEnd, bEnd);
    if (rows.length >= 4) emptyBuckets[rows[3].id] = sorted.slice(bEnd, cEnd);
    if (rows.length >= 5) emptyBuckets[rows[4].id] = sorted.slice(cEnd);
    return { buckets: emptyBuckets, insufficient: items.filter((i) => i.insufficientSample) };
  }

  const bucketSize = 1 / rows.length;
  for (let i = 0; i < rows.length; i++) {
    const start = Math.round(i * bucketSize * n);
    const end = i === rows.length - 1 ? n : Math.round((i + 1) * bucketSize * n);
    emptyBuckets[rows[i].id] = sorted.slice(start, end);
  }

  return { buckets: emptyBuckets, insufficient: items.filter((i) => i.insufficientSample) };
}

export function CommunityAverageTierList({
  ranking,
  isLoading,
  error,
  tierRows
}: {
  ranking: CommunityRankingResponse | null;
  isLoading: boolean;
  error: string | null;
  tierRows?: TierRowConfig[] | null;
}) {
  const resolvedRows = tierRows ?? DEFAULT_TIER_CONFIG.rows;

  if (isLoading) {
    return (
      <div className="mt-5 animate-pulse space-y-3">
        <div className="h-10 w-64 rounded-lg bg-slate-800" />
        <div className="h-8 w-96 rounded-lg bg-slate-800" />
        <div className="h-64 rounded-xl bg-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (ranking === null) {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/60 p-6 text-center">
        <p className="text-sm text-slate-400">
          还没有社区数据，开始对决后会逐步生成社区平均 Tier List。
        </p>
      </div>
    );
  }

  if (ranking.items.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/60 p-6 text-center">
        <p className="text-sm text-slate-400">
          还没有足够的作品数据来生成社区平均 Tier List。
        </p>
      </div>
    );
  }

  const { buckets, insufficient } = percentileBuckets(ranking.items, resolvedRows);

  return (
    <div className="mt-5">
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3">
        <p className="text-sm text-slate-300">
          基于 {ranking.totalParticipants} 位参与者的对决数据生成，共 {ranking.totalRuns} 个活跃轮次。
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-black/80 bg-[#191d21] shadow-[0_20px_90px_rgba(0,0,0,0.35)]">
        {resolvedRows.map((row) => {
          const items = buckets[row.id] ?? [];
          if (items.length === 0) return null;

          return (
            <div
              key={row.id}
              className="grid min-h-20 grid-cols-[72px_1fr] border-b border-black/80 last:border-b-0 sm:grid-cols-[100px_1fr]"
            >
              <div
                className="flex items-center justify-center px-1"
                style={{ backgroundColor: row.color }}
              >
                <span className="text-center text-xl font-extrabold text-slate-950 sm:text-3xl">
                  {row.label}
                </span>
              </div>
              <div className="flex min-h-20 flex-wrap content-start gap-2 bg-[#171b20] p-2 sm:gap-3 sm:p-3">
                {items.map((item) => (
                  <CommunityAverageCard key={item.animeId} item={item} />
                ))}
              </div>
            </div>
          );
        })}

        {insufficient.length > 0 ? (
          <div className="grid min-h-20 grid-cols-[72px_1fr] border-b border-black/80 last:border-b-0 sm:grid-cols-[100px_1fr]">
            <div className="share-tier-label-insufficient flex items-center justify-center">
              <span className="text-center text-sm font-bold text-slate-600 sm:text-base">
                样本不足
              </span>
            </div>
            <div className="flex min-h-20 flex-wrap content-start gap-2 bg-[#171b20] p-2 sm:gap-3 sm:p-3">
              {insufficient.map((item) => (
                <CommunityAverageCard key={item.animeId} item={item} />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CommunityAverageCard({ item }: { item: CommunityRankingItem }) {
  const title = item.title.length > 0 ? item.title : "未命名作品";
  const isUserGen = item.imageUrl !== null && (
    item.imageUrl.includes("tiermaker") ||
    item.imageUrl.startsWith("/uploads/custom-items/")
  );

  return (
    <article className="w-24 rounded-xl border border-white/10 bg-slate-950/72 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)] sm:w-28 sm:p-2">
      <AnimeCover
        src={item.imageUrl}
        title={title}
        size="sm"
        fit={isUserGen ? "contain" : "cover"}
        className="h-24 w-full rounded-lg sm:h-28"
      />
      <h3 className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug text-white">
        {title}
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {item.rank !== null ? (
          <span className="text-[10px] font-bold text-cyan-300">
            #{item.rank}
          </span>
        ) : null}
        {item.insufficientSample ? (
          <span className="text-[10px] text-amber-400/60">样本不足</span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {item.participantCount} 人 · {item.comparisonCount} 次
      </p>
    </article>
  );
}
