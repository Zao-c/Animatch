"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { LoadingRoom } from "@/components/LoadingRoom";
import { PageShell } from "@/components/PageShell";
import {
  getMatchQueue,
  submitComparison,
  type ComparisonResult,
  type MatchPair
} from "@/lib/client-api";
import { createClientMutationId } from "@/lib/client-id";
import { preloadPairs } from "@/lib/preload-images";

export default function MatchPage({
  params
}: {
  params: { poolId: string; runId: string };
}) {
  const [queue, setQueue] = useState<MatchPair[]>([]);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefilling, setIsRefilling] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<{ loaded: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
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
      const data = await getMatchQueue(params.poolId, params.runId, 8);
      setConfidenceScore(data.confidenceScore);
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

  async function handleSubmit(result: ComparisonResult) {
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
      setQueue((current) => current.slice(1));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提交结果失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <LoadingRoom loaded={preloadProgress?.loaded} total={preloadProgress?.total} />
      </PageShell>
    );
  }

  const currentPair = queue[0];

  if (currentPair === undefined) {
    return (
      <PageShell>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">当前没有足够可匹配的动画</h1>
          <p className="mt-3 text-sm text-zinc-400">
            可能是番组少于 2 部，或可用作品都已被隐藏。
          </p>
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={`/pools/${params.poolId}`}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              返回番组
            </Link>
            <Link
              href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200"
            >
              查看 Tier List
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">两两对决</h1>
          <p className="mt-2 text-sm text-zinc-400">
            信心指数 {confidenceScore.toFixed(1)} / 队列剩余 {queue.length}
            {isRefilling ? " / 正在补充队列" : ""}
          </p>
        </div>
        <Link
          href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          查看 Tier List
        </Link>
      </div>

      {error ? (
        <div className="mb-5 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <MatchSide pair={currentPair} side="left" disabled={isSubmitting} onPick={handleSubmit} />
        <MatchSide pair={currentPair} side="right" disabled={isSubmitting} onPick={handleSubmit} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ActionButton disabled={isSubmitting} onClick={() => handleSubmit("DRAW")}>
          差不多
        </ActionButton>
        <ActionButton disabled={isSubmitting} onClick={() => handleSubmit("SKIP")}>
          跳过
        </ActionButton>
        <ActionButton disabled={isSubmitting} onClick={() => handleSubmit("LEFT_UNSEEN")}>
          左边没看过
        </ActionButton>
        <ActionButton disabled={isSubmitting} onClick={() => handleSubmit("RIGHT_UNSEEN")}>
          右边没看过
        </ActionButton>
        <ActionButton disabled={isSubmitting} onClick={() => handleSubmit("BOTH_UNSEEN")}>
          两个都没看过
        </ActionButton>
      </div>
    </PageShell>
  );
}

function MatchSide({
  pair,
  side,
  disabled,
  onPick
}: {
  pair: MatchPair;
  side: "left" | "right";
  disabled: boolean;
  onPick: (result: ComparisonResult) => void;
}) {
  const anime = side === "left" ? pair.left : pair.right;
  const title = anime.display?.title ?? anime.titleCn ?? anime.title;
  const subtitle = anime.display?.subtitle ?? (anime.titleCn ? anime.title : null);
  const coverUrl = anime.display?.coverUrl ?? anime.imageLargeUrl ?? anime.imageMediumUrl ?? anime.imageUrl;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(side === "left" ? "LEFT_WIN" : "RIGHT_WIN")}
      className="group rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-cyan-300/60 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <AnimeCover
        src={coverUrl}
        secondarySrc={anime.imageLargeUrl ?? anime.imageMediumUrl ?? anime.imageUrl}
        title={title}
        size="lg"
      />
      <div className="mt-4">
        <h2 className="line-clamp-2 text-2xl font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <Metric label="Elo" value={anime.eloScore.toFixed(1)} />
          <Metric label="次数" value={String(anime.compareCount)} />
          <Metric label="BGM" value={anime.bangumiScore?.toFixed(1) ?? "-"} />
        </div>
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-950/70 px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function pairKeyForPair(pair: MatchPair): string {
  return [pair.left.id, pair.right.id].sort().join(":");
}
