"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DuelAnimeCard } from "@/components/DuelAnimeCard";
import { LoadingRoom } from "@/components/LoadingRoom";
import { PageShell } from "@/components/PageShell";
import { RankingProgressCard } from "@/components/RankingProgressCard";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import {
  getMatchQueue,
  getPool,
  resetRun,
  submitComparison,
  undoLastComparison,
  type ComparisonResult,
  type MatchPair,
  type MatchQueueResponse
} from "@/lib/client-api";
import { createClientMutationId } from "@/lib/client-id";
import { isCommunityBattleVisiblePool } from "@/lib/community-battle-visibility";
import { getComparisonResultForShortcut } from "@/lib/match-shortcuts";
import { preloadPairs } from "@/lib/preload-images";

export default function MatchPage({
  params
}: {
  params: { poolId: string; runId: string };
}) {
  const router = useRouter();
  const [poolName, setPoolName] = useState("当前番组");
  const [poolAnimeCount, setPoolAnimeCount] = useState<number | null>(null);
  const [queue, setQueue] = useState<MatchPair[]>([]);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [queueMeta, setQueueMeta] = useState<Pick<
    MatchQueueResponse,
    "scoreDistribution" | "progress"
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRefilling, setIsRefilling] = useState(false);
  const [refillError, setRefillError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<ComparisonResult | null>(null);
  const [canShowCommunityBattle, setCanShowCommunityBattle] = useState(false);
  const isRefillingRef = useRef(false);

  const appendUniquePairs = useCallback((incomingPairs: MatchPair[]) => {
    setQueue((current) => {
      const seenKeys = new Set(current.map(pairKeyForPair));
      const uniquePairs = incomingPairs.filter((pair) => {
        const key = pairKeyForPair(pair);

        if (seenKeys.has(key)) {
          return false;
        }

        seenKeys.add(key);
        return true;
      });

      return [...current, ...uniquePairs].slice(0, 10);
    });
  }, []);

  const loadInitialQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [pool, data] = await Promise.all([
        getPool(params.poolId),
        getMatchQueue(params.poolId, params.runId, 8)
      ]);
      setPoolName(pool.name);
      setPoolAnimeCount(pool.anime.length);
      setCanShowCommunityBattle(isCommunityBattleVisiblePool(pool));
      setConfidenceScore(data.confidenceScore);
      setQueueMeta({
        scoreDistribution: data.scoreDistribution,
        progress: data.progress
      });
      setQueue(data.pairs);
       void preloadPairs(data.pairs.slice(1, 4), { preloadCount: 3 });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载对决队列失败");
    } finally {
      setIsLoading(false);
    }
  }, [params.poolId, params.runId]);

  const refillQueue = useCallback(async () => {
    if (isRefillingRef.current) {
      return;
    }

    isRefillingRef.current = true;
    setIsRefilling(true);
    setRefillError(null);

    try {
      const data = await getMatchQueue(params.poolId, params.runId, 8);
      setConfidenceScore(data.confidenceScore);
      setQueueMeta({
        scoreDistribution: data.scoreDistribution,
        progress: data.progress
      });
      appendUniquePairs(data.pairs);
      void preloadPairs(data.pairs, { preloadCount: 4 });
    } catch (reason) {
      setRefillError(reason instanceof Error ? reason.message : "下一组对决暂时没有加载成功。");
    } finally {
      isRefillingRef.current = false;
      setIsRefilling(false);
    }
  }, [appendUniquePairs, params.poolId, params.runId]);

  const refreshProgress = useCallback(async () => {
    try {
      const data = await getMatchQueue(params.poolId, params.runId, 1);
      setConfidenceScore(data.confidenceScore);
      setQueueMeta({
        scoreDistribution: data.scoreDistribution,
        progress: data.progress
      });
    } catch {
      // Progress refresh failure should not interrupt the match.
    }
  }, [params.poolId, params.runId]);

  useEffect(() => {
    void loadInitialQueue();
  }, [loadInitialQueue]);

  useEffect(() => {
    if (!isLoading && queue.length < 3 && !isRefillingRef.current && refillError === null) {
      void refillQueue();
    }
  }, [isLoading, queue.length, refillError, refillQueue]);

  const handleSubmit = useCallback(async (result: ComparisonResult) => {
    const currentPair = queue[0];

    if (currentPair === undefined || isSubmitting) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    const isUnseen =
      result === "LEFT_UNSEEN" || result === "RIGHT_UNSEEN" || result === "BOTH_UNSEEN";

    try {
      await submitComparison(params.poolId, params.runId, {
        leftAnimeId: currentPair.left.id,
        rightAnimeId: currentPair.right.id,
        result,
        clientMutationId: createClientMutationId("comparison")
      });
      setFeedbackResult(result);
      await waitForMatchFeedback();
      setQueue((current) => current.slice(1));
      if (isUnseen) {
        void refreshProgress();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交结果失败");
    } finally {
      setFeedbackResult(null);
      setIsSubmitting(false);
    }
  }, [isSubmitting, params.poolId, params.runId, queue, refreshProgress]);

  const handleUndoLast = useCallback(async () => {
    if (
      !window.confirm("撤回后会重新计算本轮榜单。确定撤回上次选择吗？")
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsUndoing(true);

    try {
      const result = await undoLastComparison(params.poolId, params.runId);
      await loadInitialQueue();
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有可以撤回的选择。");
    } finally {
      setIsUndoing(false);
    }
  }, [loadInitialQueue, params.poolId, params.runId]);

  const handleResetRun = useCallback(async () => {
    if (
      !window.confirm(
        "这会开启一轮新的对决，旧榜单和历史记录仍会保留。确定重开吗？"
      )
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsResetting(true);

    try {
      const result = await resetRun(params.poolId, params.runId);
      router.push(result.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "重开本轮失败");
    } finally {
      setIsResetting(false);
    }
  }, [params.poolId, params.runId, router]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const result = getComparisonResultForShortcut(event);

      if (result === null) {
        return;
      }

      event.preventDefault();
      void handleSubmit(result);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSubmit]);

  if (isLoading) {
    return (
      <PageShell>
        <LoadingRoom />
      </PageShell>
    );
  }

  const currentPair = queue[0];

  if (currentPair === undefined) {
    if (refillError !== null) {
      return (
        <PageShell>
          <EmptyState
            title="下一组对决暂时没有加载成功"
            description="你的上一票已经保存。请重新加载下一组；无需重开本轮或重复投票。"
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <AppButton type="button" onClick={() => void refillQueue()} disabled={isRefilling} variant="primary">
                  {isRefilling ? "正在重新加载..." : "重新加载下一组"}
                </AppButton>
                <Link href={`/pools/${params.poolId}`} className={appButtonClasses({ variant: "ghost" })}>
                  返回番组
                </Link>
              </div>
            }
          />
        </PageShell>
      );
    }

    const emptyCopy = getMatchEmptyCopy(poolAnimeCount, queueMeta?.progress);

    return (
      <PageShell>
        {canShowCommunityBattle ? <CommunityBattleMatchHint /> : null}
        <EmptyState
          title={emptyCopy.title}
          description={emptyCopy.description}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href={`/pools/${params.poolId}`} className={appButtonClasses({ variant: "ghost" })}>
                返回番组
              </Link>
              {emptyCopy.canReset ? (
                <AppButton
                  type="button"
                  onClick={handleResetRun}
                  disabled={isResetting}
                  variant="secondary"
                >
                  {isResetting ? "重开中..." : "重开本轮"}
                </AppButton>
              ) : null}
              <Link
                href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
                className={appButtonClasses({ variant: "primary" })}
              >
                查看 Tier List
              </Link>
            </div>
          }
        />
        {error ? <ErrorAlert message={error} className="mt-5" /> : null}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="source">{canShowCommunityBattle ? "社区大乱斗" : "普通对决"}</AppBadge>
            <AppBadge tone="status">{poolName}</AppBadge>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            本轮对决
          </h1>
          <p className="mt-1 hidden text-sm leading-6 text-slate-500 sm:block">
            先选择作品；进度、统计和设置都在下方按需查看。
          </p>
          {queueMeta ? (
            <p className="mt-1.5 min-h-5 text-xs text-slate-500" aria-live="polite">
              {queueMeta.progress.stageLabel} · 有效 {queueMeta.progress.effectiveComparisons}/
              {queueMeta.progress.highConfidenceTarget}
              {isRefilling ? " · 正在准备下一组" : ""}
              {refillError !== null ? " · 下一组暂时不可用" : ""}
            </p>
          ) : null}
          {refillError !== null ? (
            <button
              type="button"
              onClick={() => void refillQueue()}
              disabled={isRefilling}
              className="min-h-9 rounded-lg px-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/10 disabled:opacity-50"
            >
              重新加载下一组
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
              className={appButtonClasses({ variant: "ghost", size: "sm" })}
            >
              查看 Tier
            </Link>
          <details className="relative">
            <summary className={appButtonClasses({ variant: "quiet", size: "sm", className: "list-none" })}>
              对决设置
            </summary>
            <div className="absolute right-0 z-20 mt-3 w-72 rounded-2xl border border-white/10 bg-slate-950/92 p-3 shadow-anime-panel backdrop-blur-xl">
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Stat label="我的稳定度" value={confidenceScore.toFixed(1)} />
                <Stat label="队列" value={String(queue.length)} />
              </div>
              <div className="grid gap-2">
                <AppButton
                  type="button"
                  onClick={handleUndoLast}
                  disabled={isSubmitting || isUndoing}
                  variant="quiet"
                  size="sm"
                  className="w-full justify-start"
                >
                  {isUndoing ? "撤回中..." : "撤回上次选择"}
                </AppButton>
                <AppButton
                  type="button"
                  onClick={handleResetRun}
                  disabled={isSubmitting || isResetting}
                  variant="quiet"
                  size="sm"
                  className="w-full justify-start"
                >
                  {isResetting ? "重开中..." : "重开本轮"}
                </AppButton>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="min-h-[34px]" aria-live="polite" aria-atomic="true">
        {notice ? <ErrorAlert message={notice} tone="notice" /> : null}
        {error ? <ErrorAlert message={error} /> : null}
      </div>
      {canShowCommunityBattle ? <CommunityBattleMatchHint /> : null}

      <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-stretch gap-2 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)]">
        <DuelAnimeCard
          key={currentPair.left.id}
          anime={currentPair.left}
          side="left"
          disabled={isSubmitting}
          actionLabel="选择左边"
          scoreDistribution={queueMeta?.scoreDistribution ?? fallbackScoreDistribution}
          onPick={() => handleSubmit("LEFT_WIN")}
          highlighted={feedbackResult === "LEFT_WIN"}
        />
        <div className="flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-anime-amber/35 bg-anime-amber/10 text-sm font-black text-amber-100 shadow-anime-amber sm:h-16 sm:w-16 sm:text-xl lg:h-20 lg:w-20 lg:text-2xl">
            VS
          </div>
        </div>
        <DuelAnimeCard
          key={currentPair.right.id}
          anime={currentPair.right}
          side="right"
          disabled={isSubmitting}
          actionLabel="选择右边"
          scoreDistribution={queueMeta?.scoreDistribution ?? fallbackScoreDistribution}
          onPick={() => handleSubmit("RIGHT_WIN")}
          highlighted={feedbackResult === "RIGHT_WIN"}
        />
      </div>

       <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-slate-950/24 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("DRAW")} variant="quiet">
            <ShortcutKey>↑</ShortcutKey>
            <span>差不多</span>
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("SKIP")} variant="quiet">
            <ShortcutKey>↓</ShortcutKey>
            <span>跳过</span>
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("LEFT_UNSEEN")} variant="quiet">
            <ShortcutKey>1</ShortcutKey>
            <span>左边没看过</span>
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("RIGHT_UNSEEN")} variant="quiet">
            <ShortcutKey>2</ShortcutKey>
            <span>右边没看过</span>
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("BOTH_UNSEEN")} variant="quiet">
            <ShortcutKey>0</ShortcutKey>
            <span>两个都没看过</span>
          </AppButton>
         </div>
         <p className="px-1 text-xs leading-5 text-slate-500">
           跳过不计分，之后仍可能再次出现；标记没看过会从本轮隐藏，不会进入你的 Tier List。
         </p>
       </div>

      {queueMeta ? (
        <div className="mt-5">
          <RankingProgressCard progress={queueMeta.progress} compact />
          <p className="mt-2 text-xs text-slate-500">
            没看过的作品不会进入你的榜单，也不会继续计入本轮目标。
          </p>
        </div>
      ) : null}
    </PageShell>
  );
}

function CommunityBattleMatchHint() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <AppBadge tone="source">社区大乱斗</AppBadge>
        <p className="min-w-0 flex-1 text-xs leading-5 text-slate-400">
          你正在参与这个公开番组的社区大乱斗。你的选择只会更新你的个人榜单，并以匿名聚合方式贡献到社区榜单。
        </p>
    </div>
  );
}

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="mr-1 inline-flex min-w-5 items-center justify-center rounded-md border border-anime-cyan/30 bg-slate-950/50 px-1.5 py-0.5 text-[11px] font-black leading-none text-cyan-100">
      {children}
    </kbd>
  );
}

function waitForMatchFeedback(): Promise<void> {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, 180);
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-black text-white">{value}</p>
    </div>
  );
}

function pairKeyForPair(pair: MatchPair): string {
  return [pair.left.id, pair.right.id].sort().join(":");
}

const fallbackScoreDistribution = {
  count: 0,
  mean: 1500,
  median: 1500,
  std: 120
};

function getMatchEmptyCopy(
  poolAnimeCount: number | null,
  progress?: MatchQueueResponse["progress"]
) {
  if (poolAnimeCount !== null && poolAnimeCount < 2) {
    return {
      title: "至少需要 2 部动画才能开始对决",
      description: "返回番组详情页继续添加动画；建议添加 4-8 部进行第一次体验。",
      canReset: false
    };
  }

  if (
    poolAnimeCount !== null &&
    poolAnimeCount >= 2 &&
    progress !== undefined &&
    progress.totalItems < 2
  ) {
    return {
      title: "可匹配作品不足",
      description:
        `你标记为没看过的作品已从本轮隐藏，当前只剩 ${progress.totalItems} 部可参与对决。可以重开本轮，或返回番组添加更多作品。`,
      canReset: true
    };
  }

  if (progress?.stage === "HIGH_CONFIDENCE") {
    return {
      title: "本轮已经达到高可信度",
      description:
        "当前排序已经比较稳定。你可以查看 Tier List，或重开本轮重新校准自己的偏好。",
      canReset: true
    };
  }

  if (poolAnimeCount !== null && poolAnimeCount >= 2) {
    return {
      title: "当前没有新的可用组合",
      description:
        "可能是本轮组合已经比较完，或最近组合暂时被去重。你可以查看 Tier List、重开本轮，或返回番组添加更多动画。",
      canReset: true
    };
  }

  return {
    title: "当前没有足够可匹配的动画",
    description: "可以添加更多作品或查看 Tier List。",
    canReset: false
  };
}
