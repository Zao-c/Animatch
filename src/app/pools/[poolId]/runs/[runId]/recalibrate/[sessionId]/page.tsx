"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DuelAnimeCard } from "@/components/DuelAnimeCard";
import { LoadingRoom } from "@/components/LoadingRoom";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import {
  getPool,
  getRecalibrationNextPair,
  getTierList,
  submitComparison,
  type ComparisonResult,
  type MatchPair,
  type RecalibrationMode,
  type RecalibrationPair,
  type RecalibrationSession,
  type TierListItem
} from "@/lib/client-api";
import { createClientMutationId } from "@/lib/client-id";
import { preloadPairs } from "@/lib/preload-images";
import { buildScoreDistribution } from "@/lib/ranking-display";

export default function RecalibratePage({
  params
}: {
  params: { poolId: string; runId: string; sessionId: string };
}) {
  const [poolName, setPoolName] = useState("当前番组");
  const [items, setItems] = useState<TierListItem[]>([]);
  const [session, setSession] = useState<RecalibrationSession | null>(null);
  const [pair, setPair] = useState<RecalibrationPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemByAnimeId = useMemo(
    () => new Map(items.map((item) => [item.animeId, item])),
    [items]
  );
  const scoreDistribution = useMemo(
    () => buildScoreDistribution(items.map((item) => item.eloScore)),
    [items]
  );
  const matchPair = pair === null ? null : toMatchPair(pair, itemByAnimeId);

  const loadNextPair = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [pool, tierList, next] = await Promise.all([
        getPool(params.poolId),
        getTierList(params.poolId, params.runId),
        getRecalibrationNextPair(params.poolId, params.runId, params.sessionId)
      ]);
      const flatItems = Object.values(tierList.tiers).flat();
      const nextMatchPair =
        next.pair === null
          ? null
          : toMatchPair(next.pair, new Map(flatItems.map((item) => [item.animeId, item])));

      setPoolName(pool.name);
      setItems(flatItems);
      setSession(next.session);
      setPair(next.pair);

      if (nextMatchPair !== null) {
        await preloadPairs([nextMatchPair], { preloadCount: 1 });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载校准对决失败");
    } finally {
      setIsLoading(false);
    }
  }, [params.poolId, params.runId, params.sessionId]);

  useEffect(() => {
    void loadNextPair();
  }, [loadNextPair]);

  async function handleSubmit(result: ComparisonResult) {
    if (matchPair === null || session === null || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitComparison(params.poolId, params.runId, {
        leftAnimeId: matchPair.left.id,
        rightAnimeId: matchPair.right.id,
        result,
        mode: modeForSession(session),
        recalibrationSessionId: session.id,
        clientMutationId: createClientMutationId("comparison")
      });
      await loadNextPair();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交校准结果失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <LoadingRoom message="正在准备校准对决..." />
      </PageShell>
    );
  }

  if (matchPair === null || session === null || session.status === "COMPLETED") {
    const completed = session?.status === "COMPLETED";

    return (
      <PageShell>
        <EmptyState
          title={
            completed
              ? "本轮校准完成"
              : "当前没有足够可校准的组合"
          }
          description={
            completed
              ? "你的榜单已经根据最新选择更新。"
              : "当前没有足够可校准的组合。通常是因为动画数量较少，或当前可比较组合已经完成。你可以添加更多动画，或先进行普通对决。"
          }
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
                className={appButtonClasses({ variant: "primary" })}
              >
                查看 Tier List
              </Link>
              <Link
                href={`/pools/${params.poolId}/runs/${params.runId}/match`}
                className={appButtonClasses({ variant: "ghost" })}
              >
                继续普通对决
              </Link>
            </div>
          }
        />
        {error ? <ErrorAlert message={error} className="mt-5" /> : null}
      </PageShell>
    );
  }

  const activeSession = session;

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="source">校准实验室</AppBadge>
            <AppBadge tone="status">{poolName}</AppBadge>
            <AppBadge tone="tier">{activeSession.type}</AppBadge>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            微调实验室
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            已完成 {activeSession.completedCount} / {activeSession.plannedCount} 场。每次选择都会用于修正榜单边界。
          </p>
        </div>
        <Link
          href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
          className={appButtonClasses({ variant: "ghost" })}
        >
          查看 Tier List
        </Link>
      </div>

      <AppCard className="mb-5 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <AppBadge tone="source">为什么是它们？</AppBadge>
            <p className="mt-3 text-sm leading-6 text-cyan-50">{pair?.reason}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              系统会优先选择分数接近、信息不足或未直接比较过的作品。
            </p>
          </div>
          <div className="text-sm text-slate-500">
            {activeSession.completedCount} / {activeSession.plannedCount}
          </div>
        </div>
      </AppCard>
      {error ? <ErrorAlert message={error} className="mb-5" /> : null}

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)]">
        <DuelAnimeCard
          anime={matchPair.left}
          side="left"
          disabled={isSubmitting}
          actionLabel="选择左边"
          scoreDistribution={scoreDistribution}
          onPick={() => handleSubmit("LEFT_WIN")}
        />
        <div className="flex items-center justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-purple-300/30 bg-purple-300/10 text-3xl font-black text-purple-100 shadow-[0_0_45px_rgba(187,134,252,0.22)]">
            VS
          </div>
        </div>
        <DuelAnimeCard
          anime={matchPair.right}
          side="right"
          disabled={isSubmitting}
          actionLabel="选择右边"
          scoreDistribution={scoreDistribution}
          onPick={() => handleSubmit("RIGHT_WIN")}
        />
      </div>

      <AppCard className="mt-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("DRAW")} variant="secondary">
            差不多
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("SKIP")} variant="ghost">
            跳过
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("LEFT_UNSEEN")} variant="ghost">
            左边没看过
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("RIGHT_UNSEEN")} variant="ghost">
            右边没看过
          </AppButton>
          <AppButton disabled={isSubmitting} onClick={() => handleSubmit("BOTH_UNSEEN")} variant="ghost">
            两个都没看过
          </AppButton>
        </div>
      </AppCard>
    </PageShell>
  );
}

function toMatchPair(
  pair: RecalibrationPair,
  itemByAnimeId: Map<string, TierListItem>
): MatchPair | null {
  const left = itemByAnimeId.get(pair.leftAnimeId);
  const right = itemByAnimeId.get(pair.rightAnimeId);

  if (left === undefined || right === undefined) {
    return null;
  }

  return {
    pairId: `${pair.leftAnimeId}:${pair.rightAnimeId}`,
    left,
    right,
    reason: pair.reason
  };
}

function modeForSession(session: RecalibrationSession): RecalibrationMode {
  if (session.type === "RANGE") {
    return "RANGE_RECALIBRATE";
  }

  if (session.type === "FOCUS") {
    return "FOCUS_RECALIBRATE";
  }

  return "RECALIBRATE";
}
