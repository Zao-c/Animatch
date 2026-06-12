"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DuelAnimeCard } from "@/components/DuelAnimeCard";
import { LoadingRoom } from "@/components/LoadingRoom";
import { PageShell } from "@/components/PageShell";
import { RankingProgressCard } from "@/components/RankingProgressCard";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import {
  getMatchQueue,
  getPool,
  submitComparison,
  type ComparisonResult,
  type MatchPair,
  type MatchQueueResponse
} from "@/lib/client-api";
import { createClientMutationId } from "@/lib/client-id";
import { getComparisonResultForShortcut } from "@/lib/match-shortcuts";
import { preloadPairs } from "@/lib/preload-images";

export default function MatchPage({
  params
}: {
  params: { poolId: string; runId: string };
}) {
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
  const [isRefilling, setIsRefilling] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<{ loaded: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<ComparisonResult | null>(null);
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
      setConfidenceScore(data.confidenceScore);
      setQueueMeta({
        scoreDistribution: data.scoreDistribution,
        progress: data.progress
      });
      setQueue(data.pairs);
      const progress = await preloadPairs(data.pairs, {
        firstPairRequired: true,
        preloadCount: 4
      });
      setPreloadProgress(progress);
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

    try {
      const data = await getMatchQueue(params.poolId, params.runId, 8);
      setConfidenceScore(data.confidenceScore);
      setQueueMeta({
        scoreDistribution: data.scoreDistribution,
        progress: data.progress
      });
      appendUniquePairs(data.pairs);
      void preloadPairs(data.pairs, { preloadCount: 4 });
    } catch {
      // Background refill should not interrupt the current match.
    } finally {
      isRefillingRef.current = false;
      setIsRefilling(false);
    }
  }, [appendUniquePairs, params.poolId, params.runId]);

  useEffect(() => {
    void loadInitialQueue();
  }, [loadInitialQueue]);

  useEffect(() => {
    if (!isLoading && queue.length > 0 && queue.length < 3) {
      void refillQueue();
    }
  }, [isLoading, queue.length, refillQueue]);

  const handleSubmit = useCallback(async (result: ComparisonResult) => {
    const currentPair = queue[0];

    if (currentPair === undefined || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交结果失败");
    } finally {
      setFeedbackResult(null);
      setIsSubmitting(false);
    }
  }, [isSubmitting, params.poolId, params.runId, queue]);

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
        <LoadingRoom loaded={preloadProgress?.loaded} total={preloadProgress?.total} />
      </PageShell>
    );
  }

  const currentPair = queue[0];

  if (currentPair === undefined) {
    const emptyCopy = getMatchEmptyCopy(poolAnimeCount);

    return (
      <PageShell>
        <EmptyState
          title={emptyCopy.title}
          description={emptyCopy.description}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href={`/pools/${params.poolId}`} className={appButtonClasses({ variant: "ghost" })}>
                返回番组
              </Link>
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
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="source">普通对决</AppBadge>
            <AppBadge tone="status">{poolName}</AppBadge>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            两两对决舞台
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            点击整张卡或使用方向键快速选择。分数和统计已收进详细指标，先专注判断作品。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Stat label="信心指数" value={confidenceScore.toFixed(1)} />
          <Stat label="队列剩余" value={String(queue.length)} />
          <Link
            href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
            className={appButtonClasses({ variant: "ghost", className: "self-end" })}
          >
            查看 Tier List
          </Link>
        </div>
      </div>

      {isRefilling ? <ErrorAlert message="正在补充后续对局..." tone="notice" className="mb-5" /> : null}
      {error ? <ErrorAlert message={error} className="mb-5" /> : null}
      {queueMeta ? (
        <div className="mb-6">
          <RankingProgressCard progress={queueMeta.progress} compact />
        </div>
      ) : null}

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)]">
        <DuelAnimeCard
          anime={currentPair.left}
          side="left"
          disabled={isSubmitting}
          actionLabel="选择左边"
          scoreDistribution={queueMeta?.scoreDistribution ?? fallbackScoreDistribution}
          onPick={() => handleSubmit("LEFT_WIN")}
          highlighted={feedbackResult === "LEFT_WIN"}
        />
        <div className="flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-anime-amber/35 bg-anime-amber/10 text-2xl font-black text-amber-100 shadow-anime-amber lg:h-24 lg:w-24 lg:text-3xl">
            VS
          </div>
        </div>
        <DuelAnimeCard
          anime={currentPair.right}
          side="right"
          disabled={isSubmitting}
          actionLabel="选择右边"
          scoreDistribution={queueMeta?.scoreDistribution ?? fallbackScoreDistribution}
          onPick={() => handleSubmit("RIGHT_WIN")}
          highlighted={feedbackResult === "RIGHT_WIN"}
        />
      </div>

      <AppCard className="mt-6 p-4" variant="soft">
        <MatchShortcutHint />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("DRAW")} variant="quiet">
            差不多
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("SKIP")} variant="quiet">
            跳过
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("LEFT_UNSEEN")} variant="quiet">
            左边没看过
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("RIGHT_UNSEEN")} variant="quiet">
            右边没看过
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("BOTH_UNSEEN")} variant="quiet">
            两个都没看过
          </AppButton>
        </div>
      </AppCard>
    </PageShell>
  );
}

function MatchShortcutHint() {
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-400" aria-label="Match keyboard shortcuts">
      {[
        "← 左胜",
        "→ 右胜",
        "↑ 差不多",
        "↓ 跳过",
        "1 左未看",
        "2 右未看",
        "0 都未看"
      ].map((item) => (
        <span key={item} className="rounded-full border border-anime-border bg-white/[0.03] px-2.5 py-1">
          {item}
        </span>
      ))}
    </div>
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
    <div className="min-w-28 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur-xl">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
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

function getMatchEmptyCopy(poolAnimeCount: number | null) {
  if (poolAnimeCount !== null && poolAnimeCount < 2) {
    return {
      title: "至少需要 2 部动画才能开始对决",
      description: "返回番组详情页继续添加动画；建议添加 4-8 部进行第一次体验。"
    };
  }

  if (poolAnimeCount !== null && poolAnimeCount >= 2) {
    return {
      title: "当前番组的可用组合已经比较完了",
      description:
        "你可以查看 Tier List，添加更多动画，或使用手动最终设定微调排序。"
    };
  }

  return {
    title: "当前没有足够可匹配的动画",
    description: "可以添加更多作品或查看 Tier List。"
  };
}
