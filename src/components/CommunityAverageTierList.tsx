"use client";

import React from "react";
import { AnimeCover } from "./AnimeCover";
import type { CommunityRankingResponse, CommunityRankingItem } from "@/lib/client-api";
import { buildCommunityTierBuckets } from "@/lib/community-tier-buckets";
import { DEFAULT_TIER_CONFIG, type TierRowConfig } from "@/lib/tier-config";

export interface CommunityTierPreviewItem {
  animeId: string;
  title: string;
  imageUrl: string | null;
  fit?: "cover" | "contain";
}

export function CommunityAverageTierList({
  ranking,
  isLoading,
  error,
  tierRows,
  previewItems = []
}: {
  ranking: CommunityRankingResponse | null;
  isLoading: boolean;
  error: string | null;
  tierRows?: TierRowConfig[] | null;
  previewItems?: CommunityTierPreviewItem[];
}) {
  const resolvedRows = tierRows ?? DEFAULT_TIER_CONFIG.rows;

  if (isLoading) {
    return <CommunityTierListSkeleton rows={resolvedRows} />;
  }

  if (error) {
    return (
      <div className="mt-5 rounded-xl border border-red-400/25 bg-red-400/10 p-4">
        <p className="text-sm font-semibold text-red-200">社区平均 Tier List 暂时加载失败。</p>
        <p className="mt-1 text-sm leading-6 text-red-100/80">{error}</p>
      </div>
    );
  }

  if (ranking === null || ranking.items.length === 0) {
    return (
      <CommunityTierEmptyState
        previewItems={previewItems}
        isUnavailable={ranking === null}
      />
    );
  }

  const { buckets, insufficient } = buildCommunityTierBuckets(ranking.items, resolvedRows);

  return (
    <div className="mt-5 space-y-5">
      <p className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-sm leading-6 text-slate-300">
        社区平均 Tier List 使用宽版布局，按社区聚合 Elo 排序后分桶。样本不足的作品会保留展示，但不会挤进正式排名。
      </p>

      <section className="overflow-hidden rounded-2xl border border-black/80 bg-[#191d21] shadow-[0_20px_90px_rgba(0,0,0,0.35)]">
        {resolvedRows.map((row) => {
          const items = buckets[row.id] ?? [];
          if (items.length === 0) return null;

          return (
            <div
              key={row.id}
              className="grid min-h-24 grid-cols-[72px_1fr] border-b border-black/80 last:border-b-0 sm:grid-cols-[112px_1fr]"
            >
              <div
                className="flex items-center justify-center px-2"
                style={{ backgroundColor: row.color }}
              >
                <span className="text-center text-xl font-extrabold text-slate-950 sm:text-3xl">
                  {row.label}
                </span>
              </div>
              <div className="flex min-h-24 flex-wrap content-start gap-3 bg-[#171b20] p-3 sm:gap-4 sm:p-4">
                {items.map((item) => (
                  <CommunityAverageCard key={item.animeId} item={item} />
                ))}
              </div>
            </div>
          );
        })}

        {insufficient.length > 0 ? (
          <div className="grid min-h-24 grid-cols-[72px_1fr] border-b border-black/80 last:border-b-0 sm:grid-cols-[112px_1fr]">
            <div className="share-tier-label-insufficient flex items-center justify-center px-2">
              <span className="text-center text-sm font-bold text-slate-600 sm:text-base">
                样本不足
              </span>
            </div>
            <div className="flex min-h-24 flex-wrap content-start gap-3 bg-[#171b20] p-3 sm:gap-4 sm:p-4">
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

function CommunityTierListSkeleton({ rows }: { rows: TierRowConfig[] }) {
  return (
    <div className="mt-5 space-y-4 animate-pulse">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-16 rounded-xl bg-slate-800/80" />
        <div className="h-16 rounded-xl bg-slate-800/80" />
        <div className="h-16 rounded-xl bg-slate-800/80" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
        {rows.slice(0, 5).map((row, rowIndex) => (
          <div
            key={row.id}
            className="grid min-h-24 grid-cols-[72px_1fr] border-b border-white/8 last:border-b-0 sm:grid-cols-[112px_1fr]"
          >
            <div className="flex items-center justify-center" style={{ backgroundColor: row.color }}>
              <span className="text-xl font-black text-slate-950/50">{row.label}</span>
            </div>
            <div className="flex gap-3 p-3 sm:p-4">
              {Array.from({ length: rowIndex < 2 ? 4 : 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 w-28 rounded-xl bg-slate-800/80 sm:h-40 sm:w-32"
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function CommunityTierEmptyState({
  previewItems,
  isUnavailable
}: {
  previewItems: CommunityTierPreviewItem[];
  isUnavailable: boolean;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-5">
        <p className="text-base font-semibold text-white">
          {isUnavailable ? "社区平均 Tier List 正在准备" : "还没有玩家对决数据"}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          公开番组会在用户完成个人对决后生成社区聚合结果。现在先展示作品池预览，避免测试环境看起来像是空页面。
        </p>
      </div>

      {previewItems.length > 0 ? (
        <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200/80">
                Preview
              </p>
              <h3 className="mt-1 text-lg font-black text-white">待生成榜单作品预览</h3>
            </div>
            <p className="text-xs text-slate-500">显示前 {previewItems.length} 个作品</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {previewItems.map((item) => (
              <CommunityPreviewCard key={item.animeId} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CommunityAverageCard({ item }: { item: CommunityRankingItem }) {
  const title = item.title.length > 0 ? item.title : "未命名作品";

  return (
    <article className="w-28 rounded-xl border border-white/10 bg-slate-950/72 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.2)] sm:w-32">
      <AnimeCover
        src={item.imageUrl}
        title={title}
        size="sm"
        fit="contain"
        className="h-36 w-full rounded-lg sm:h-40"
      />
      <h3 className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-white">
        {title}
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {item.rank !== null ? (
          <span className="rounded-full bg-cyan-300/12 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
            #{item.rank}
          </span>
        ) : null}
        {item.insufficientSample ? (
          <span className="rounded-full bg-amber-300/12 px-2 py-0.5 text-[10px] font-bold text-amber-200">
            样本不足
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        {item.participantCount} 人 · {item.comparisonCount} 次
      </p>
    </article>
  );
}

function CommunityPreviewCard({ item }: { item: CommunityTierPreviewItem }) {
  const title = item.title.length > 0 ? item.title : "未命名作品";

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
      <AnimeCover
        src={item.imageUrl}
        title={title}
        size="sm"
        fit={item.fit ?? "contain"}
        className="aspect-[3/4] h-auto w-full rounded-none border-0"
      />
      <div className="p-2">
        <h4 className="line-clamp-2 min-h-8 text-xs font-semibold leading-4 text-white">
          {title}
        </h4>
      </div>
    </article>
  );
}
