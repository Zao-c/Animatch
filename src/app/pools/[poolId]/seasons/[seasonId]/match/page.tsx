"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { PageShell } from "@/components/PageShell";
import { AnimeCover } from "@/components/AnimeCover";
import { getSeasonDetail, getSeasonMatchQueue, setSeasonAnimeHidden, submitSeasonVote } from "@/lib/client-api";
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
  const coverUrl = anime.imageMediumUrl ?? anime.imageUrl;
  const secondarySrc = anime.imageLargeUrl ?? anime.imageSmallUrl ?? anime.thumbnailUrl ?? anime.imageUrl;

  return (
    <button
      type="button"
      aria-label={`投给 ${title}`}
      onClick={onPick}
      disabled={disabled}
      className={`relative flex min-h-44 cursor-pointer flex-col overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 hover:border-amber-200/45 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-amber-300/60 focus:ring-offset-2 focus:ring-offset-slate-950 ${
        highlighted
          ? "border-amber-300 shadow-[0_0_40px_rgba(252,211,77,0.15)]"
          : "border-white/10 hover:border-white/20 active:border-amber-300/50"
      } ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-900 relative">
        <AnimeCover
          src={coverUrl}
          secondarySrc={secondarySrc}
          title={title}
          size="lg"
          fit="cover"
          animeId={anime.animeId}
          className="h-full w-full rounded-none border-0"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-slate-950/18 via-transparent to-transparent" />
      <div className="relative mt-auto border-t border-white/5 bg-slate-950/24 p-4 backdrop-blur-[2px]">
        <h2 className="line-clamp-2 text-lg font-black leading-7 tracking-tight text-white/76">
          {title}
        </h2>
      </div>
    </button>
  );
}

function filterSeasonQueue(
  queue: SeasonMatchQueueItem[],
  skippedPairs: ReadonlySet<string>,
  hiddenAnimeIds: ReadonlySet<string>
): SeasonMatchQueueItem[] {
  return queue.filter(
    (item) =>
      !skippedPairs.has(seasonMatchPairKey(item)) &&
      !hiddenAnimeIds.has(item.left.animeId) &&
      !hiddenAnimeIds.has(item.right.animeId)
  );
}

function seasonMatchPairKey(pair: SeasonMatchQueueItem): string {
  return [pair.left.animeId, pair.right.animeId].sort().join(":");
}

function seasonUnseenStorageKey(seasonId: string): string {
  return `animematch:season:${seasonId}:unseen-anime`;
}

function readSeasonUnseenAnimeIds(seasonId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(seasonUnseenStorageKey(seasonId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeasonUnseenAnimeIds(seasonId: string, animeIds: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(seasonUnseenStorageKey(seasonId), JSON.stringify([...animeIds]));
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function SeasonMatchSkeleton() {
  return <div className="mx-auto max-w-4xl animate-pulse px-4 py-8"><div className="h-96 rounded-3xl bg-white/5" /></div>;
}

type SeasonFeedback = "LEFT_WIN" | "RIGHT_WIN" | "SKIP" | "LEFT_UNSEEN" | "RIGHT_UNSEEN" | "BOTH_UNSEEN";

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/15 bg-slate-950/80 px-1.5 text-[10px] font-bold text-slate-200">
      {children}
    </kbd>
  );
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
  const [feedback, setFeedback] = useState<SeasonFeedback | null>(null);
  const [useBias, setUseBias] = useState(false);
  const [voteResult, setVoteResult] = useState<{ stepNumber: number; votesRemaining: number } | null>(null);
  const [skippedPairKeys, setSkippedPairKeys] = useState<Set<string>>(new Set());
  const [unseenAnimeIds, setUnseenAnimeIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (
    skippedPairs: ReadonlySet<string>,
    hiddenAnimeIds: ReadonlySet<string>
  ) => {
    try {
      const [d, q] = await Promise.all([
        getSeasonDetail(poolId, seasonId),
        getSeasonMatchQueue(poolId, seasonId, {
          limit: 5,
          excludePairKeys: [...skippedPairs],
          hiddenAnimeIds: [...hiddenAnimeIds]
        })
      ]);
      setDetail(d);
      let filtered = filterSeasonQueue(q, skippedPairs, hiddenAnimeIds);
      if (filtered.length === 0 && skippedPairs.size > 0) {
        const resetSkippedPairs = new Set<string>();
        const fallbackQueue = await getSeasonMatchQueue(poolId, seasonId, {
          limit: 5,
          hiddenAnimeIds: [...hiddenAnimeIds]
        });
        setSkippedPairKeys(resetSkippedPairs);
        filtered = filterSeasonQueue(fallbackQueue, resetSkippedPairs, hiddenAnimeIds);
      }
      setQueue(filtered);
      setCurrentIndex(0);
      setVoteResult(null);
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
      setLoading(false);
    }
  }, [poolId, seasonId]);

  useEffect(() => {
    const hiddenIds = readSeasonUnseenAnimeIds(seasonId);
    const skippedPairs = new Set<string>();
    setUnseenAnimeIds(hiddenIds);
    setSkippedPairKeys(skippedPairs);
    setLoading(true);
    void fetchData(skippedPairs, hiddenIds);
  }, [fetchData, seasonId]);

  const currentPair = queue.length > currentIndex ? queue[currentIndex] : null;

  const handleRollPair = useCallback(() => {
    if (feedback === "SKIP") return;
    setFeedback("SKIP");
    setUseBias(false);
    setVoteResult(null);
    let nextSkippedPairKeys = skippedPairKeys;
    if (currentPair) {
      nextSkippedPairKeys = new Set(skippedPairKeys);
      nextSkippedPairKeys.add(seasonMatchPairKey(currentPair));
      setSkippedPairKeys(nextSkippedPairKeys);
    }
    const filteredQueue = filterSeasonQueue(queue, nextSkippedPairKeys, unseenAnimeIds);
    if (filteredQueue.length > 0) {
      setQueue(filteredQueue);
      setCurrentIndex(0);
    } else {
      void fetchData(nextSkippedPairKeys, unseenAnimeIds);
    }
    window.setTimeout(() => setFeedback(null), 360);
  }, [currentPair, feedback, fetchData, queue, skippedPairKeys, unseenAnimeIds]);

  const handleMarkUnseen = useCallback(async (kind: Extract<SeasonFeedback, "LEFT_UNSEEN" | "RIGHT_UNSEEN" | "BOTH_UNSEEN">) => {
    if (!currentPair || submitting) return;

    const hiddenIds =
      kind === "LEFT_UNSEEN"
        ? [currentPair.left.animeId]
        : kind === "RIGHT_UNSEEN"
          ? [currentPair.right.animeId]
          : [currentPair.left.animeId, currentPair.right.animeId];

    setSubmitting(true);
    try {
      const result = await setSeasonAnimeHidden(poolId, seasonId, {
        animeIds: hiddenIds,
        isHidden: true
      });
      const nextUnseenAnimeIds = new Set(result.hiddenAnimeIds);
      for (const animeId of hiddenIds) nextUnseenAnimeIds.add(animeId);
      writeSeasonUnseenAnimeIds(seasonId, nextUnseenAnimeIds);
      setUnseenAnimeIds(nextUnseenAnimeIds);

      const nextSkippedPairKeys = new Set(skippedPairKeys);
      nextSkippedPairKeys.add(seasonMatchPairKey(currentPair));
      setSkippedPairKeys(nextSkippedPairKeys);

      const filteredQueue = filterSeasonQueue(queue, nextSkippedPairKeys, nextUnseenAnimeIds);
      setQueue(filteredQueue);
      setCurrentIndex(0);
      setUseBias(false);
      setVoteResult(null);
      setFeedback(kind);

      if (filteredQueue.length === 0) {
        void fetchData(nextSkippedPairKeys, nextUnseenAnimeIds);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "排除作品失败");
    } finally {
      setSubmitting(false);
    }
    window.setTimeout(() => setFeedback(null), 420);
  }, [currentPair, fetchData, poolId, queue, seasonId, skippedPairKeys, submitting]);

  async function handleResetUnseen() {
    const emptySet = new Set<string>();
    setLoading(true);
    try {
      await setSeasonAnimeHidden(poolId, seasonId, {
        animeIds: [],
        isHidden: false
      });
      const resetSkippedPairs = new Set<string>();
      writeSeasonUnseenAnimeIds(seasonId, emptySet);
      setUnseenAnimeIds(emptySet);
      setSkippedPairKeys(resetSkippedPairs);
      void fetchData(resetSkippedPairs, emptySet);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "恢复作品失败");
      setLoading(false);
    }
  }

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
        void (async () => {
          try {
            setFeedback(null);
            const shouldLoadNextBatch = currentIndex >= queue.length - 1;
            if (result.votesRemaining <= 0 || shouldLoadNextBatch) {
              setUseBias(false);
              await fetchData(skippedPairKeys, unseenAnimeIds);
            } else {
              setCurrentIndex((prev) => prev + 1);
              setUseBias(false);
              setVoteResult(null);
            }
          } finally {
            setSubmitting(false);
          }
        })();
      }, 600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "投票失败");
      setSubmitting(false);
    }
  }, [currentPair, submitting, poolId, seasonId, detail, useBias, fetchData, currentIndex, queue.length, skippedPairKeys, unseenAnimeIds]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!currentPair || submitting) return;
      if (isEditableShortcutTarget(e.target)) return;
      if (e.repeat) return;

      const canUseBiasShortcut =
        detail?.mode === "BIAS" && (detail.currentUserState?.biasVotesRemaining ?? 0) > 0;
      let handled = true;
      if (e.key === "ArrowLeft") {
        handleVote(currentPair.left.animeId);
      } else if (e.key === "ArrowRight") {
        handleVote(currentPair.right.animeId);
      } else if (e.key === "ArrowDown") {
        handleRollPair();
      } else if (e.key === "ArrowUp" && canUseBiasShortcut) {
        setUseBias((prev) => !prev);
      } else if (e.key === "1") {
        handleMarkUnseen("LEFT_UNSEEN");
      } else if (e.key === "2") {
        handleMarkUnseen("RIGHT_UNSEEN");
      } else if (e.key === "3" || e.key === "0") {
        handleMarkUnseen("BOTH_UNSEEN");
      } else if ((e.key === "b" || e.key === "B" || e.key === "Shift") && canUseBiasShortcut) {
        setUseBias((prev) => !prev);
      } else {
        handled = false;
      }

      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPair, submitting, handleVote, detail, handleRollPair, handleMarkUnseen]);

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
          <Link href={`/pools/${poolId}/seasons/${seasonId}`} className="inline-flex min-h-11 items-center text-sm text-slate-400 transition hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300/60">← 返回赛季</Link>
          <AppBadge tone={detail.status === "ACTIVE" ? "success" : "muted"}>
            {detail.status === "ACTIVE" ? "进行中" : "已结束"}
          </AppBadge>
          <AppBadge tone="source">{detail.mode === "BIAS" ? "偏爱模式" : "传统模式"}</AppBadge>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">{detail.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              优先给你没比较过的组合；覆盖后继续用 Elo 接近、低置信度的组合做校准。换一组不会消耗票数。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unseenAnimeIds.size > 0 ? (
              <button
                type="button"
                onClick={handleResetUnseen}
                disabled={loading}
                className="min-h-11 rounded-full border border-amber-300/20 bg-amber-300/5 px-4 text-sm font-semibold text-amber-100 transition hover:border-amber-200/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                恢复已排除 {unseenAnimeIds.size} 部
              </button>
            ) : null}
            {currentPair ? (
              <button
                type="button"
                onClick={handleRollPair}
                disabled={submitting || feedback === "SKIP"}
                className="min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                换一组
              </button>
            ) : null}
          </div>
        </div>

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

        {currentPair && canVote ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1">
              当前第 {currentIndex + 1} / {queue.length} 组
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.025] px-3 py-1">
              <ShortcutKey>←</ShortcutKey>
              <ShortcutKey>→</ShortcutKey>
              投票
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.025] px-3 py-1">
              <ShortcutKey>↓</ShortcutKey>
              跳过
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.025] px-3 py-1">
              <ShortcutKey>1</ShortcutKey>
              <ShortcutKey>2</ShortcutKey>
              <ShortcutKey>3</ShortcutKey>
              没看过
            </span>
            <span>本批投完会自动获取下一批作品，直到你的票数用完。</span>
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
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/5 px-4 py-2 text-sm text-rose-200 select-none">
                  <input
                    type="checkbox"
                    checked={useBias}
                    onChange={(e) => setUseBias(e.target.checked)}
                    className="h-4 w-4 rounded accent-rose-400"
                  />
                  使用私心票 (共享榜单加成, 剩余 {cs.biasVotesRemaining})
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

            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={handleRollPair}
                disabled={submitting || feedback === "SKIP"}
                className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  feedback === "SKIP"
                    ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.035] text-slate-200 hover:border-cyan-300/35"
                }`}
              >
                <span className="inline-flex items-center gap-2"><ShortcutKey>↓</ShortcutKey> 跳过 / 换一组</span>
              </button>
              <button
                type="button"
                onClick={() => handleMarkUnseen("LEFT_UNSEEN")}
                disabled={submitting}
                className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  feedback === "LEFT_UNSEEN"
                    ? "border-amber-300/50 bg-amber-300/10 text-amber-100"
                    : "border-white/10 bg-white/[0.035] text-slate-200 hover:border-amber-300/35"
                }`}
              >
                <span className="inline-flex items-center gap-2"><ShortcutKey>1</ShortcutKey> 左边没看过</span>
              </button>
              <button
                type="button"
                onClick={() => handleMarkUnseen("RIGHT_UNSEEN")}
                disabled={submitting}
                className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  feedback === "RIGHT_UNSEEN"
                    ? "border-amber-300/50 bg-amber-300/10 text-amber-100"
                    : "border-white/10 bg-white/[0.035] text-slate-200 hover:border-amber-300/35"
                }`}
              >
                <span className="inline-flex items-center gap-2"><ShortcutKey>2</ShortcutKey> 右边没看过</span>
              </button>
              <button
                type="button"
                onClick={() => handleMarkUnseen("BOTH_UNSEEN")}
                disabled={submitting}
                className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  feedback === "BOTH_UNSEEN"
                    ? "border-amber-300/50 bg-amber-300/10 text-amber-100"
                    : "border-white/10 bg-white/[0.035] text-slate-200 hover:border-amber-300/35"
                }`}
              >
                <span className="inline-flex items-center gap-2"><ShortcutKey>3</ShortcutKey> 都没看过</span>
              </button>
            </div>
          </div>
        ) : (
          <AppCard className="mt-8 p-6 text-center">
            <h2 className="text-xl font-black text-white">
              {canVote && unseenAnimeIds.size > 0
                ? "当前筛选后没有可投组合"
                : canVote
                  ? "当前批次已投完"
                  : skippedPairKeys.size > 0
                    ? "暂时没有更多可换组合"
                    : "没有可用的投票对"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {canVote && unseenAnimeIds.size > 0
                ? `你已排除 ${unseenAnimeIds.size} 部没看过的作品，可以恢复后继续，或稍后再获取新组合。`
                : canVote
                ? "你还有剩余票数，可以继续获取下一批作品。"
                : skippedPairKeys.size > 0
                  ? "可以先投当前组或稍后再试。"
                  : "需要至少 2 个作品才能生成投票对"}
            </p>
            {canVote ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {unseenAnimeIds.size > 0 ? (
                  <AppButton variant="secondary" onClick={handleResetUnseen}>
                    恢复已排除作品
                  </AppButton>
                ) : null}
                <AppButton
                  variant="primary"
                  onClick={() => {
                    setLoading(true);
                    void fetchData(skippedPairKeys, unseenAnimeIds);
                  }}
                >
                  获取下一批作品
                </AppButton>
              </div>
            ) : null}
          </AppCard>
        )}
      </main>
    </PageShell>
  );
}
