"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { PageShell } from "@/components/PageShell";
import { AnimeCover } from "@/components/AnimeCover";
import { getSeasonDetail, getSeasonMatchQueue, submitSeasonVote } from "@/lib/client-api";
import { proxyExternalImageUrl, getProxiedCoverCandidates } from "@/lib/image-proxy";
import { getAnimeDisplayTitle } from "@/lib/anime-display";
import type { SeasonDetail, SeasonMatchQueueItem, SeasonAnimeEntry } from "@/lib/client-api";

function SeasonDuelCard({
  anime,
  disabled,
  onPick,
  highlighted
}: {
  anime: SeasonAnimeEntry;
  disabled: boolean;
  onPick: () => void;
  highlighted: boolean;
}) {
  const title = getAnimeDisplayTitle(anime);
  const candidates = getProxiedCoverCandidates(anime.imageMediumUrl ?? anime.imageUrl, null);
  const coverUrl = candidates[0] ?? null;

  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className={`relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
        highlighted
          ? "border-amber-300 shadow-[0_0_40px_rgba(252,211,77,0.15)]"
          : "border-white/10 hover:border-white/20 active:border-amber-300/50"
      } ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-800">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white/20">
            {title.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
      <div className="relative mt-auto p-4">
        <h2 className="line-clamp-2 min-h-[3rem] text-lg font-black leading-7 tracking-tight text-white/90">
          {title}
        </h2>
      </div>
    </button>
  );
}

function SeasonMatchSkeleton() {
  return <div className="mx-auto max-w-4xl animate-pulse px-4 py-8"><div className="h-96 rounded-3xl bg-white/5" /></div>;
}

export default function SeasonMatchPage() {
  const params = useParams<{ poolId: string; seasonId: string }>();
  const { poolId, seasonId } = params;

  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [queue, setQueue] = useState<SeasonMatchQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [useBias, setUseBias] = useState(false);
  const [voteResult, setVoteResult] = useState<{ stepNumber: number; votesRemaining: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [d, q] = await Promise.all([
        getSeasonDetail(poolId, seasonId),
        getSeasonMatchQueue(poolId, seasonId)
      ]);
      setDetail(d);
      setQueue(q);
      setCurrentIndex(0);
      setVoteResult(null);
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
      setLoading(false);
    }
  }, [poolId, seasonId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentPair = queue.length > currentIndex ? queue[currentIndex] : null;

  const handleVote = useCallback(async (winnerId: string) => {
    if (!currentPair || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitSeasonVote(poolId, seasonId, {
        leftAnimeId: currentPair.left.animeId,
        rightAnimeId: currentPair.right.animeId,
        winnerAnimeId: winnerId,
        useBiasVote: detail?.mode === "BIAS" && useBias
      });
      setVoteResult({ stepNumber: result.stepNumber, votesRemaining: result.votesRemaining });
      setFeedback(winnerId === currentPair.left.animeId ? "LEFT_WIN" : "RIGHT_WIN");
      setTimeout(() => {
        setFeedback(null);
        if (result.votesRemaining <= 0) {
          fetchData();
        } else {
          setCurrentIndex((prev) => prev + 1);
          setUseBias(false);
          setVoteResult(null);
        }
      }, 600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "投票失败");
    } finally {
      setSubmitting(false);
    }
  }, [currentPair, submitting, poolId, seasonId, detail, useBias, fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!currentPair || submitting) return;
      if (e.key === "ArrowLeft") handleVote(currentPair.left.animeId);
      if (e.key === "ArrowRight") handleVote(currentPair.right.animeId);
      if (e.key === "b" || e.key === "B" || e.key === "Shift") setUseBias((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPair, submitting, handleVote]);

  if (loading) return <PageShell><SeasonMatchSkeleton /></PageShell>;
  if (error) return <PageShell><main className="mx-auto max-w-4xl px-4 py-8"><AppCard className="p-8 text-center"><h1 className="text-xl font-black text-white">加载失败</h1><p className="mt-2 text-sm text-slate-400">{error}</p><Link href={`/pools/${poolId}/seasons/${seasonId}`} className="mt-4 inline-block text-sm text-amber-200 underline">返回赛季详情</Link></AppCard></main></PageShell>;
  if (!detail) return null;

  const cs = detail.currentUserState;
  const isSeasonEnded = detail.status === "ENDED";
  const canVote = detail.status === "ACTIVE" && !isSeasonEnded && cs && cs.votesRemaining > 0;

  return (
    <PageShell>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href={`/pools/${poolId}/seasons/${seasonId}`} className="text-xs text-slate-500 hover:text-amber-200">← 返回赛季</Link>
          <AppBadge tone={detail.status === "ACTIVE" ? "success" : "muted"}>
            {detail.status === "ACTIVE" ? "进行中" : "已结束"}
          </AppBadge>
          <AppBadge tone="source">{detail.mode === "BIAS" ? "偏爱模式" : "传统模式"}</AppBadge>
        </div>
        <h1 className="text-2xl font-black text-white">{detail.title}</h1>

        {cs ? (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <span className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-center">
              <span className="text-xs text-slate-400">已投</span> <strong className="text-white">{cs.votesUsed}</strong>
            </span>
            <span className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-center">
              <span className="text-xs text-slate-400">剩余</span> <strong className="text-amber-200">{cs.votesRemaining}</strong>
            </span>
            {detail.mode === "BIAS" ? (
              <>
                <span className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-center">
                  <span className="text-xs text-slate-400">私心已用</span> <strong className="text-rose-300">{cs.biasVotesUsed}</strong>
                </span>
                <span className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-center">
                  <span className="text-xs text-slate-400">私心剩余</span> <strong className="text-rose-300">{cs.biasVotesRemaining}</strong>
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        {voteResult ? (
          <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-2 text-sm text-amber-200">
            已投票！第 {voteResult.stepNumber} 票 · 剩余 {voteResult.votesRemaining} 票
          </div>
        ) : null}

        {isSeasonEnded ? (
          <AppCard className="mt-8 p-6 text-center">
            <AppBadge tone="muted">赛季已结束</AppBadge>
            <h2 className="mt-4 text-xl font-black text-white">投票已关闭</h2>
            <p className="mt-2 text-sm text-slate-400">共 {detail.totalVotes} 票 · {detail.participantCount} 人参与</p>
          </AppCard>
        ) : !canVote && cs ? (
          <AppCard className="mt-8 p-6 text-center">
            <h2 className="text-xl font-black text-white">投票次数已用完</h2>
            <p className="mt-2 text-sm text-slate-400">你已完成 {cs.votesUsed} 次投票</p>
          </AppCard>
        ) : currentPair ? (
          <div className="mt-8">
            {detail.mode === "BIAS" && cs && cs.biasVotesRemaining > 0 ? (
              <div className="mb-4 flex items-center justify-center">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/5 px-4 py-2 text-sm text-rose-200 select-none">
                  <input
                    type="checkbox"
                    checked={useBias}
                    onChange={(e) => setUseBias(e.target.checked)}
                    className="h-4 w-4 rounded accent-rose-400"
                  />
                  使用私心票 (权重×2, 剩余 {cs.biasVotesRemaining})
                  <span className="ml-1 text-xs text-slate-500">或按 Shift</span>
                </label>
              </div>
            ) : null}

            <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)]">
              <SeasonDuelCard
                key={currentPair.left.animeId + String(currentIndex)}
                anime={currentPair.left}
                disabled={submitting}
                onPick={() => handleVote(currentPair.left.animeId)}
                highlighted={feedback === "LEFT_WIN"}
              />
              <div className="flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/10 bg-slate-950/80 text-lg font-black text-white/20 shadow-[0_0_60px_rgba(0,0,0,0.5)]">
                  VS
                </div>
              </div>
              <SeasonDuelCard
                key={currentPair.right.animeId + String(currentIndex)}
                anime={currentPair.right}
                disabled={submitting}
                onPick={() => handleVote(currentPair.right.animeId)}
                highlighted={feedback === "RIGHT_WIN"}
              />
            </div>
          </div>
        ) : (
          <AppCard className="mt-8 p-6 text-center">
            <h2 className="text-xl font-black text-white">没有可用的投票对</h2>
            <p className="mt-2 text-sm text-slate-400">需要至少 2 个作品才能生成投票对</p>
          </AppCard>
        )}
      </main>
    </PageShell>
  );
}
