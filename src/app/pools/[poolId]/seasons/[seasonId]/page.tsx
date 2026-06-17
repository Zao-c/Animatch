"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageShell } from "@/components/PageShell";
import { getSeasonDetail, startSeason, endSeason } from "@/lib/client-api";
import { formatDateTimeStable } from "@/lib/date-format";
import type { SeasonDetail, SeasonRankingItem } from "@/lib/client-api";

function SeasonSkeleton() {
  return <div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-white/10" /><div className="h-64 rounded-2xl bg-white/5" /></div>;
}

export default function SeasonDetailPage() {
  const params = useParams<{ poolId: string; seasonId: string }>();
  const { poolId, seasonId } = params;

  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(() => {
    getSeasonDetail(poolId, seasonId)
      .then((d) => { setDetail(d); setLoading(false); })
      .catch((e) => { setError(e.message ?? "加载失败"); setLoading(false); });
  }, [poolId, seasonId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleStart = async () => {
    setActionLoading(true);
    try { await startSeason(poolId, seasonId); fetchDetail(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "启动失败"); }
    finally { setActionLoading(false); }
  };

  const handleEnd = async () => {
    setActionLoading(true);
    try { await endSeason(poolId, seasonId); fetchDetail(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "结束失败"); }
    finally { setActionLoading(false); }
  };

  if (loading) return <PageShell><main className="mx-auto max-w-4xl px-4 py-8"><SeasonSkeleton /></main></PageShell>;
  if (error) return <PageShell><main className="mx-auto max-w-4xl px-4 py-8"><AppCard className="p-8 text-center"><AppBadge tone="tier">AniMatch</AppBadge><h1 className="mt-4 text-xl font-black text-white">加载失败</h1><p className="mt-2 text-sm text-slate-400">{error}</p></AppCard></main></PageShell>;
  if (!detail) return null;

  return (
    <PageShell>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href={`/pools/${poolId}`} className="text-xs text-slate-500 hover:text-amber-200">← 返回番组</Link>
        </div>

        <AppCard className="mb-8 p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <AppBadge tone={detail.status === "ACTIVE" ? "success" : detail.status === "ENDED" ? "muted" : "warning"}>
              {detail.status === "ACTIVE" ? "进行中" : detail.status === "ENDED" ? "已结束" : "未开始"}
            </AppBadge>
            <AppBadge tone="source">{detail.mode === "BIAS" ? "偏爱模式" : "传统模式"}</AppBadge>
          </div>
          <h1 className="text-2xl font-black text-white">{detail.title}</h1>
          {detail.description ? <p className="mt-2 text-sm text-slate-400">{detail.description}</p> : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="参与人数" value={String(detail.participantCount)} />
            <StatCard label="总投票" value={String(detail.totalVotes)} />
            <StatCard label="私心票使用" value={String(detail.biasVotesUsed)} />
            <StatCard label="开始时间" value={formatDateTimeStable(detail.startsAt).split(" ")[0]} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>每人最多 {detail.maxVotesPerUser} 票</span>
            {detail.maxVotesPerUserPerDay ? <span>· 每天 {detail.maxVotesPerUserPerDay} 票</span> : null}
            {detail.mode === "BIAS" ? <span>· 私心票 ×{detail.biasVotesPerUser}</span> : null}
            {detail.endsAt ? <span>· 至 {formatDateTimeStable(detail.endsAt).split(" ")[0]}</span> : null}
          </div>

          {detail.currentUserState ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold text-white">我的进度</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
                <span>已投 {detail.currentUserState.votesUsed} 票</span>
                <span>剩余 {detail.currentUserState.votesRemaining} 票</span>
                {detail.mode === "BIAS" ? <span>私心票已用 {detail.currentUserState.biasVotesUsed}</span> : null}
                {detail.mode === "BIAS" ? <span>私心票剩余 {detail.currentUserState.biasVotesRemaining}</span> : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {detail.status === "ACTIVE" ? (
              <Link href={`/pools/${poolId}/seasons/${seasonId}/match`} className={appButtonClasses({ variant: "primary" })}>
                开始对决
              </Link>
            ) : null}
            {detail.status === "DRAFT" ? (
              <AppButton onClick={handleStart} disabled={actionLoading} variant="primary">启动赛季</AppButton>
            ) : null}
            {detail.status === "ACTIVE" ? (
              <AppButton onClick={handleEnd} disabled={actionLoading} variant="danger">结束赛季</AppButton>
            ) : null}
          </div>
        </AppCard>

        <AppCard className="mb-8 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">赛季榜单</h2>
          {detail.ranking.length === 0 ? (
            <p className="text-sm text-slate-500">暂无投票数据</p>
          ) : (
            <div className="space-y-2">
              {detail.ranking.slice(0, 20).map((item, idx) => (
                <div key={item.animeId} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.015] px-4 py-2">
                  <span className="w-8 text-center text-sm font-bold text-amber-200">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span className="text-amber-200 font-semibold">{item.score} 分</span>
                    <span>{item.winCount} 胜</span>
                    {item.biasWinCount > 0 ? <span className="text-rose-300">{item.biasWinCount} 私心</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AppCard>

        <AppCard className="p-6">
          <h2 className="mb-4 text-lg font-bold text-white">最近投票</h2>
          {detail.recentVotes.length === 0 ? (
            <p className="text-sm text-slate-500">暂无投票记录</p>
          ) : (
            <div className="space-y-2">
              {detail.recentVotes.map((v) => (
                <div key={v.stepNumber} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="text-xs text-slate-600">第 {v.stepNumber} 步</span>
                  <span className="font-medium text-white/80">{v.displayName}</span>
                  <span className="text-slate-400">
                    {v.voteType === "BIAS" ? (
                      <span className="text-rose-300">用私心票选择</span>
                    ) : "选择"}
                  </span>
                  <span className="font-semibold text-amber-200">{v.winnerTitle}</span>
                  <span className="text-slate-500">胜</span>
                  <span className="text-slate-400">{v.loserTitle}</span>
                  <span className="ml-auto text-xs text-slate-600">权重 {v.weight}</span>
                </div>
              ))}
            </div>
          )}
        </AppCard>
      </main>
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}
