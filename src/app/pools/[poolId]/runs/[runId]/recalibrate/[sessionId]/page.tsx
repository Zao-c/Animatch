"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { LoadingRoom } from "@/components/LoadingRoom";
import { PageShell } from "@/components/PageShell";
import {
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
import { preloadPairs } from "@/lib/preload-images";

export default function RecalibratePage({
  params
}: {
  params: { poolId: string; runId: string; sessionId: string };
}) {
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
  const matchPair = pair === null ? null : toMatchPair(pair, itemByAnimeId);

  const loadNextPair = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [tierList, next] = await Promise.all([
        getTierList(params.poolId, params.runId),
        getRecalibrationNextPair(params.poolId, params.runId, params.sessionId)
      ]);
      const flatItems = Object.values(tierList.tiers).flat();
      const nextMatchPair = next.pair === null ? null : toMatchPair(next.pair, new Map(flatItems.map((item) => [item.animeId, item])));

      setItems(flatItems);
      setSession(next.session);
      setPair(next.pair);

      if (nextMatchPair !== null) {
        await preloadPairs([nextMatchPair], { firstPairRequired: true, preloadCount: 1 });
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
        clientMutationId: crypto.randomUUID()
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
    return (
      <PageShell>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">本轮校准完成</h1>
          <p className="mt-3 text-sm text-zinc-400">
            已完成 {session?.completedCount ?? 0} / {session?.plannedCount ?? 0} 场。
          </p>
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200"
            >
              查看 Tier List
            </Link>
            <Link
              href={`/pools/${params.poolId}/runs/${params.runId}/match`}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              继续普通对决
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const activeSession = session;

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">校准模式</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {activeSession.type} / {activeSession.completedCount} / {activeSession.plannedCount}
          </p>
        </div>
        <Link
          href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          查看 Tier List
        </Link>
      </div>

      <div className="mb-5 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
        为什么是它们？{pair?.reason}
      </div>
      {error ? <p className="mb-5 text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <RecalibrateSide pair={matchPair} side="left" disabled={isSubmitting} onPick={handleSubmit} />
        <RecalibrateSide pair={matchPair} side="right" disabled={isSubmitting} onPick={handleSubmit} />
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

function RecalibrateSide({
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
  const title = anime.titleCn ?? anime.title;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(side === "left" ? "LEFT_WIN" : "RIGHT_WIN")}
      className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-cyan-300/60 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <AnimeCover
        src={anime.imageLargeUrl ?? anime.imageMediumUrl ?? anime.imageUrl}
        title={title}
        size="lg"
      />
      <h2 className="mt-4 line-clamp-2 text-2xl font-semibold text-white">{title}</h2>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        <Metric label="Elo" value={anime.eloScore.toFixed(1)} />
        <Metric label="次数" value={String(anime.compareCount)} />
        <Metric label="BGM" value={anime.bangumiScore?.toFixed(1) ?? "-"} />
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
