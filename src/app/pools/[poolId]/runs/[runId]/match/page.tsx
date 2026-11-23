"use client";

import { MatchRecap } from "@/components/MatchRecap";
import { PersonalCandidatePicker } from "@/components/PersonalCandidatePicker";
import { MatchSessionGoal } from "@/components/MatchSessionGoal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MatchActions, MatchArena, MatchHeading, MatchWorkspace } from "@/components/MatchPresentation";
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
  ApiClientError,
  getPool,
  resetRun,
  replacePersonalMatchCandidates,
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
import { isSlowNetwork } from "@/lib/cover-prewarm";
import { clearPendingVote, readPendingVote, storePendingVote, VOTE_LABELS, type PendingMatchVote } from "@/lib/pending-match-vote";

export default function MatchPage({
  params
}: {
  params: { poolId: string; runId: string };
}) {
  return <MatchPageContent key={`${params.poolId}:${params.runId}`} params={params} />;
}

function MatchPageContent({ params }: { params: { poolId: string; runId: string } }) {
  const router = useRouter();
  const [effectiveCount, setEffectiveCount] = useState(0);
  const [poolName, setPoolName] = useState("当前番组");
  const [scopeCounts, setScopeCounts] = useState({ candidates: 0, paused: 0 });
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
  const interactionLock = useRef(false);
  const unseenIds = useRef(new Set<string>());
  const queueGeneration = useRef(0);
  const pendingVote = useRef<PendingMatchVote["request"] | null>(null);
  const ownerId = useRef<string | null>(null);
  const hasStoredVote = useRef(false);
  const storageCleanupFailed = useRef(false);
  const [recoveredVote, setRecoveredVote] = useState<PendingMatchVote | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [editingCandidates, setEditingCandidates] = useState(false);
  const candidateEditorOpen = useRef(false);
  const returnToCandidateTrigger = useRef(false);

  const clearStoredVote = useCallback(() => {
    if (!ownerId.current || !hasStoredVote.current) return;
    try {
      clearPendingVote(ownerId.current, params.poolId, params.runId);
      hasStoredVote.current = false;
      storageCleanupFailed.current = false;
      setStorageWarning(null);
    } catch {
      storageCleanupFailed.current = true;
      setStorageWarning("本票已处理，但浏览器恢复记录未能清除。请恢复浏览器存储后再撤回或重开，避免恢复过期选择。");
    }
  }, [params.poolId, params.runId]);

  const appendUniquePairs = useCallback((incomingPairs: MatchPair[]) => {
    setQueue((current) => {
      const seenKeys = new Set(current.map(pairKeyForPair));
      const uniquePairs = incomingPairs.filter((pair) => {
        if (unseenIds.current.has(pair.left.id) || unseenIds.current.has(pair.right.id)) return false;
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
    const generation = ++queueGeneration.current;
    isRefillingRef.current = false;
    setIsRefilling(false);
    setIsLoading(true);
    setError(null);
    setRefillError(null);
    setQueue([]);

    try {
      const [pool, data] = await Promise.all([
        getPool(params.poolId),
        getMatchQueue(params.poolId, params.runId, 8)
      ]);
      if (generation !== queueGeneration.current) return;
      ownerId.current = data.draftOwnerId ?? null;
      if (ownerId.current) {
        try {
          const stored = readPendingVote(ownerId.current, params.poolId, params.runId);
          hasStoredVote.current = stored !== null;
          pendingVote.current = stored?.request ?? null;
          setRecoveredVote(stored);
        } catch {
          setStorageWarning("无法读取浏览器中的待确认投票。请先查看当前榜单；本页不会自动重发，暂不能保证刷新恢复。");
        }
      }
      setEffectiveCount(data.progress.effectiveComparisons);
      setPoolName(pool.name);
      setPoolAnimeCount(pool.anime.length);
      setCanShowCommunityBattle(isCommunityBattleVisiblePool(pool));
      setScopeCounts({ candidates: data.candidateCount ?? data.progress.totalItems, paused: data.pausedCount ?? 0 });
      setConfidenceScore(data.confidenceScore);
      setQueueMeta({
        scoreDistribution: data.scoreDistribution,
        progress: data.progress
      });
      setQueue(data.pairs);
    } catch (reason) {
      if (generation === queueGeneration.current) setError(reason instanceof Error ? reason.message : "加载对决队列失败");
    } finally {
      if (generation === queueGeneration.current) setIsLoading(false);
    }
  }, [params.poolId, params.runId]);

  const refillQueue = useCallback(async () => {
    if (isRefillingRef.current || candidateEditorOpen.current) {
      return;
    }

    isRefillingRef.current = true;
    const generation = queueGeneration.current;
    setIsRefilling(true);
    setRefillError(null);

    try {
      const data = await getMatchQueue(params.poolId, params.runId, 8);
      if (generation !== queueGeneration.current) return;
      setScopeCounts({ candidates: data.candidateCount ?? data.progress.totalItems, paused: data.pausedCount ?? 0 });
      setConfidenceScore(data.confidenceScore);
      setQueueMeta({
        scoreDistribution: data.scoreDistribution,
        progress: data.progress
      });
      appendUniquePairs(data.pairs);
    } catch (reason) {
      if (generation === queueGeneration.current) setRefillError(reason instanceof Error ? reason.message : "下一组对决暂时没有加载成功。");
    } finally {
      if (generation === queueGeneration.current) {
        isRefillingRef.current = false;
        setIsRefilling(false);
      }
    }
  }, [appendUniquePairs, params.poolId, params.runId]);

  const refreshProgress = useCallback(async () => {
    const generation = queueGeneration.current;
    try {
      const data = await getMatchQueue(params.poolId, params.runId, 1);
      if (generation !== queueGeneration.current) return;
      setScopeCounts({ candidates: data.candidateCount ?? data.progress.totalItems, paused: data.pausedCount ?? 0 });
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
    const generationRef = queueGeneration;
    unseenIds.current.clear();
    pendingVote.current = null;
    void loadInitialQueue();
    return () => { generationRef.current++; };
  }, [loadInitialQueue]);

  useEffect(() => {
    if (scopeCounts.candidates >= 2 && !editingCandidates && !isLoading && !isSubmitting && !pendingVote.current && !error && !recoveredVote && queue.length < 5 && !isRefillingRef.current && refillError === null) {
      void refillQueue();
    }
  }, [scopeCounts.candidates, editingCandidates, isLoading, isSubmitting, queue.length, error, refillError, refillQueue, recoveredVote]);

  useEffect(() => {
    const controller = new AbortController();
    // Follow the next choices as the queue advances; avoid warming a whole batch
    // that might be discarded by an unseen vote or an undo.
    void preloadPairs(queue.slice(1), { preloadCount: isSlowNetwork() ? 1 : 3, signal: controller.signal });
    return () => controller.abort();
  }, [queue]);

  const handleSubmit = useCallback(async (result: ComparisonResult) => {
    const currentPair = queue[0];

    if (currentPair === undefined || candidateEditorOpen.current || interactionLock.current || isLoading || isSubmitting || isUndoing || isResetting || recoveredVote) {
      return;
    }

    if (!ownerId.current) { setError("暂时无法确认投票账号，请刷新页面后重试。"); return; }

    if (pendingVote.current && pendingVote.current.result !== result) {
      setError("上一票的保存状态尚未确认，请先重试上一票，再撤回或更改选择");
      return;
    }
    const wasPending = pendingVote.current !== null;
    pendingVote.current ??= {
      leftAnimeId: currentPair.left.id,
      rightAnimeId: currentPair.right.id,
      result,
      clientMutationId: createClientMutationId("comparison"),
      expectedUserId: ownerId.current
    };
    try {
      storePendingVote({ version: 1, ownerId: ownerId.current, poolId: params.poolId, runId: params.runId,
        leftTitle: currentPair.left.titleCn || currentPair.left.title, rightTitle: currentPair.right.titleCn || currentPair.right.title,
        request: pendingVote.current });
      hasStoredVote.current = true;
      storageCleanupFailed.current = false;
      setStorageWarning(null);
    } catch { setStorageWarning("浏览器暂存不可用。本页仍可重试；请等保存成功后再刷新或离开。"); }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    interactionLock.current = true;

    const isUnseen =
      result === "LEFT_UNSEEN" || result === "RIGHT_UNSEEN" || result === "BOTH_UNSEEN";

    try {
      const submitted = await submitComparison(params.poolId, params.runId, pendingVote.current);
      clearStoredVote();
      pendingVote.current = null;
      if (submitted.comparison.undoneAt) {
        await loadInitialQueue();
        setNotice("这票已在其他页面撤回，已同步当前进度。");
        return;
      }
      if (submitted.comparison.isEffective && ["LEFT_WIN", "RIGHT_WIN", "DRAW"].includes(result)) setEffectiveCount((count) => count + 1);
      setFeedbackResult(result);
      if (result === "LEFT_UNSEEN" || result === "BOTH_UNSEEN") unseenIds.current.add(currentPair.left.id);
      if (result === "RIGHT_UNSEEN" || result === "BOTH_UNSEEN") unseenIds.current.add(currentPair.right.id);
      await waitForMatchFeedback();
      setQueue((current) => current.slice(1).filter((pair) => !unseenIds.current.has(pair.left.id) && !unseenIds.current.has(pair.right.id)));
      if (isUnseen) {
        void refreshProgress();
      }
    } catch (reason) {
      // Validation/auth failures have a definite outcome; transport/server
      // failures may have committed and must reuse the same mutation ID.
      if (!wasPending && reason instanceof ApiClientError && [400, 401, 403, 404, 422].includes(reason.status)) {
        clearStoredVote();
        pendingVote.current = null;
      }
      setError(reason instanceof Error ? reason.message : "提交结果失败");
    } finally {
      setFeedbackResult(null);
      setIsSubmitting(false);
      interactionLock.current = false;
    }
  }, [isLoading, isSubmitting, isUndoing, isResetting, params.poolId, params.runId, queue, refreshProgress, recoveredVote, clearStoredVote, loadInitialQueue]);

  const confirmRecoveredVote = useCallback(async () => {
    if (!recoveredVote || interactionLock.current) return;
    interactionLock.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitComparison(params.poolId, params.runId, recoveredVote.request);
      clearStoredVote();
      pendingVote.current = null;
      setRecoveredVote(null);
      // The queue was fetched after the reload and may already include this
      // vote's effect. Reload server progress instead of incrementing it twice.
      await loadInitialQueue();
      setNotice(result.comparison.undoneAt ? "这票已经撤回，已同步当前进度。" : "上一票已确认保存，可以继续对决。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法确认，请稍后重试。");
    } finally {
      interactionLock.current = false;
      setIsSubmitting(false);
    }
  }, [recoveredVote, params.poolId, params.runId, clearStoredVote, loadInitialQueue]);

  const handleUndoLast = useCallback(async () => {
    if (interactionLock.current || candidateEditorOpen.current) return;
    if (storageCleanupFailed.current) { clearStoredVote(); if (storageCleanupFailed.current) return; }
    if (pendingVote.current) { setError("请先重试并确认上一票，再撤回选择"); return; }
    if (
      !window.confirm("撤回后会重新计算本轮榜单。确定撤回上次选择吗？")
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsUndoing(true);
    interactionLock.current = true;

    try {
      const result = await undoLastComparison(params.poolId, params.runId);
      unseenIds.current.clear();
      await loadInitialQueue();
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有可以撤回的选择。");
    } finally {
      setIsUndoing(false);
      interactionLock.current = false;
    }
  }, [loadInitialQueue, params.poolId, params.runId, clearStoredVote]);

  const handleResetRun = useCallback(async () => {
    if (interactionLock.current || candidateEditorOpen.current) return;
    if (storageCleanupFailed.current) { clearStoredVote(); if (storageCleanupFailed.current) return; }
    if (pendingVote.current) { setError("请先重试并确认上一票，再重开本轮"); return; }
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
    interactionLock.current = true;

    try {
      const result = await resetRun(params.poolId, params.runId);
      router.push(result.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "重开本轮失败");
    } finally {
      setIsResetting(false);
      interactionLock.current = false;
    }
  }, [params.poolId, params.runId, router, clearStoredVote]);

  function openCandidateEditor() {
    if (interactionLock.current || isLoading || pendingVote.current || !ownerId.current) return;
    candidateEditorOpen.current = true;
    queueGeneration.current++;
    isRefillingRef.current = false;
    setIsRefilling(false);
    setQueue([]);
    setEditingCandidates(true);
  }

  async function closeCandidateEditor() {
    if (interactionLock.current) return;
    candidateEditorOpen.current = false;
    setEditingCandidates(false);
    returnToCandidateTrigger.current = true;
    unseenIds.current.clear();
    await loadInitialQueue();
  }

  async function saveCandidates(includedAnimeIds: string[], expectedVersion: string) {
    if (interactionLock.current || pendingVote.current || !ownerId.current) throw new Error("请先等待当前操作完成。");
    interactionLock.current = true;
    try {
      await replacePersonalMatchCandidates(params.poolId, params.runId, { includedAnimeIds, expectedVersion, expectedUserId: ownerId.current });
      candidateEditorOpen.current = false;
      setEditingCandidates(false);
      returnToCandidateTrigger.current = true;
      unseenIds.current.clear();
      await loadInitialQueue();
      setNotice("本轮对决范围已保存，已有评分和 Tier 排名保留。");
    } finally { interactionLock.current = false; }
  }

  useEffect(() => {
    if (!editingCandidates && !isLoading && returnToCandidateTrigger.current) {
      const trigger = document.getElementById("personal-candidate-trigger");
      if (trigger) { trigger.focus(); returnToCandidateTrigger.current = false; }
    }
  }, [editingCandidates, isLoading, isRefilling, queue.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (candidateEditorOpen.current) return;
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

  if (editingCandidates && ownerId.current) {
    return <PageShell><main className="mx-auto max-w-6xl"><h1 className="text-xl font-bold">{poolName}</h1><PersonalCandidatePicker poolId={params.poolId} runId={params.runId} ownerId={ownerId.current} onSave={saveCandidates} onClose={() => void closeCandidateEditor()} /></main></PageShell>;
  }

  if (isLoading) {
    return (
      <PageShell>
        <LoadingRoom />
      </PageShell>
    );
  }

  const currentPair = queue[0];
  const interactionBusy = isSubmitting || isUndoing || isResetting;
  const candidateTrigger = ownerId.current && <AppButton id="personal-candidate-trigger" variant="secondary" size="sm" disabled={interactionBusy || !!pendingVote.current} onClick={openCandidateEditor}>本轮对决范围{scopeCounts.paused > 0 ? ` · 暂停 ${scopeCounts.paused} 部` : ""}</AppButton>;

  if (recoveredVote) {
    return <PageShell><section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-cyan-300/30 bg-slate-950/50 p-6">
      <h1 className="text-xl font-bold">发现一票尚未确认的选择</h1>
      <p className="text-sm leading-6 text-slate-300">刷新前的请求可能已保存。确认时会复用原来的编号，不会再次计票；确认后再继续选择。</p>
      <dl className="space-y-2 text-sm"><div><dt className="text-slate-400">左边</dt><dd>{recoveredVote.leftTitle}</dd></div><div><dt className="text-slate-400">右边</dt><dd>{recoveredVote.rightTitle}</dd></div><div><dt className="text-slate-400">你的选择</dt><dd className="font-bold text-cyan-200">{VOTE_LABELS[recoveredVote.request.result]}</dd></div></dl>
      {error && <ErrorAlert message={error} />}
      {storageWarning && <p role="alert" className="text-sm text-amber-200">{storageWarning}</p>}
      <div className="flex flex-wrap gap-3"><AppButton disabled={isSubmitting} onClick={() => void confirmRecoveredVote()}>{isSubmitting ? "正在确认…" : "确认上一票并继续"}</AppButton><Link href={`/pools/${params.poolId}/runs/${params.runId}/tier`} className={appButtonClasses({ variant: "ghost" })}>查看当前榜单</Link><Link href={`/pools/${params.poolId}`} className={appButtonClasses({ variant: "ghost" })}>返回番组</Link></div>
      <AppButton variant="quiet" disabled={isSubmitting} onClick={() => {
        if (!window.confirm("放弃本标签页的恢复记录，不会撤销服务器可能已经保存的投票。确定放弃恢复并重新加载对决？")) return;
        clearStoredVote();
        if (storageCleanupFailed.current) return;
        pendingVote.current = null;
        setRecoveredVote(null);
        void loadInitialQueue();
      }}>放弃本地恢复</AppButton>
    </section></PageShell>;
  }

  if (currentPair === undefined && error) {
    return <PageShell><EmptyState title="对决暂时加载失败" description={error} action={<div className="flex flex-wrap justify-center gap-3"><AppButton variant="primary" onClick={() => void loadInitialQueue()}>重新加载对决</AppButton>{candidateTrigger}<Link href={`/pools/${params.poolId}`} className={appButtonClasses({ variant: "ghost" })}>返回番组</Link></div>} /></PageShell>;
  }

  if (currentPair === undefined && isRefilling) {
    return <PageShell><LoadingRoom /><p role="status" className="mt-4 text-center text-sm text-slate-300">正在准备下一组…</p></PageShell>;
  }

  if (currentPair === undefined) {
    if (refillError !== null) {
      return (
        <PageShell>
          <EmptyState
            title="下一组对决暂时没有加载成功"
            description="请重新加载下一组，或调整本轮对决范围；无需重开本轮。"
            action={
              <div className="flex flex-wrap justify-center gap-3">
                {candidateTrigger}
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

    const emptyCopy = scopeCounts.candidates < 2 && scopeCounts.paused > 0 ? {
      title: "当前范围不足 2 部作品",
      description: `还有 ${scopeCounts.paused} 部作品被暂停，打开本轮对决范围可恢复；已有评分和 Tier 排名保留。`,
      canReset: false
    } : getMatchEmptyCopy(poolAnimeCount, queueMeta?.progress);

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
              {candidateTrigger}
              <AppButton type="button" variant="quiet" onClick={handleUndoLast} disabled={interactionBusy || !!pendingVote.current}>{isUndoing ? "撤回中…" : "撤回上次选择"}</AppButton>
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
    <PageShell contentClassName="!py-3">
      <MatchWorkspace>
      <MatchHeading mode="personal" title={poolName} backHref={`/pools/${params.poolId}`} description="选出更喜欢的作品，按自己的节奏完善个人榜单。" context={<span className="text-slate-400">随时继续 · 不限票数</span>} tools={<>
            <Link
              href={`/pools/${params.poolId}/runs/${params.runId}/tier`}
              className={appButtonClasses({ variant: "ghost", size: "sm" })}
            >
              查看 Tier
            </Link>
          {candidateTrigger}
          <AppButton type="button" onClick={handleUndoLast} disabled={interactionBusy} variant="quiet" size="sm">{isUndoing ? "撤回中…" : "撤回上次选择"}</AppButton>
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
          </details></>}>
          {queueMeta ? (
            <p className="mt-1.5 min-h-5 text-xs text-slate-500" aria-live="polite">
              {queueMeta.progress.stageLabel} · 有效 {effectiveCount}/
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
      </MatchHeading>

      {ownerId.current && <MatchSessionGoal key={ownerId.current} scopeKey={`${ownerId.current}:${params.poolId}:${params.runId}`} count={effectiveCount} resultHref={`/pools/${params.poolId}/runs/${params.runId}/tier`} disabled={interactionBusy || !!pendingVote.current} />}

      <div role="status" aria-live="polite" aria-atomic="true" className="mb-2 min-h-6 text-center text-sm text-cyan-100">
        {isSubmitting ? feedbackResult ? "已记录，准备下一组…" : "正在保存选择…" : notice ?? "点击封面，选出更喜欢的一部"}
      </div>
      {error ? <ErrorAlert message={`${error}。当前对决已保留，请重试。`} className="mb-3" /> : null}
      {storageWarning && <p role="alert" className="mb-3 text-sm text-amber-200">{storageWarning}</p>}
      {error && !pendingVote.current && <div className="mb-3 text-center"><AppButton disabled={interactionBusy} onClick={() => void loadInitialQueue()} variant="secondary">重新获取对局</AppButton></div>}
      {error && pendingVote.current ? <div className="mb-3 text-center"><AppButton disabled={interactionBusy} onClick={() => { if (pendingVote.current) void handleSubmit(pendingVote.current.result); }}>重试上一票</AppButton></div> : null}


      <MatchArena
        left={<DuelAnimeCard key={currentPair.left.id} anime={currentPair.left} side="left" disabled={interactionBusy} actionLabel="更喜欢左边" scoreDistribution={queueMeta?.scoreDistribution ?? fallbackScoreDistribution} onPick={() => handleSubmit("LEFT_WIN")} highlighted={feedbackResult === "LEFT_WIN"} />}
        right={<DuelAnimeCard key={currentPair.right.id} anime={currentPair.right} side="right" disabled={interactionBusy} actionLabel="更喜欢右边" scoreDistribution={queueMeta?.scoreDistribution ?? fallbackScoreDistribution} onPick={() => handleSubmit("RIGHT_WIN")} highlighted={feedbackResult === "RIGHT_WIN"} />}
      />
      <MatchActions disabled={interactionBusy} onDraw={() => handleSubmit("DRAW")} onSkip={() => handleSubmit("SKIP")} onUnseen={handleSubmit} hint="跳过不计分；没看过的作品从本轮隐藏，不进入你的 Tier List。" />

      <details className="mt-3 rounded-xl border border-white/10 px-3 text-sm text-slate-400">
      <summary className="min-h-11 cursor-pointer py-3">进度、阶段小结与社区说明</summary>
      <MatchRecap count={effectiveCount} scopeKey={params.runId} endpoint={`/api/pools/${params.poolId}/runs/${params.runId}/tierlist`} resultHref={`/pools/${params.poolId}/runs/${params.runId}/tier`} />
      <div className="mt-3">{canShowCommunityBattle ? <CommunityBattleMatchHint /> : null}</div>
      {queueMeta ? (
        <div className="mt-5">
          <RankingProgressCard progress={queueMeta.progress} compact />
          <p className="mt-2 text-xs text-slate-500">
            没看过的作品不会进入你的榜单，也不会继续计入本轮目标。
          </p>
        </div>
      ) : null}
      </details>
      </MatchWorkspace>
    </PageShell>
  );
}

function CommunityBattleMatchHint() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <AppBadge tone="source">参与社区榜</AppBadge>
        <p className="min-w-0 flex-1 text-xs leading-5 text-slate-400">
          本轮选择会更新个人榜单并汇入社区榜；口味对照会展示玩家昵称和共同作品上的明显分歧。
        </p>
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
        `你标记为没看过的作品已从本轮隐藏，当前只剩 ${progress.totalItems} 部可参与对决。误点没看过可撤回上次选择；也可以调整对决范围、重开本轮或添加更多作品。`,
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
        "可以先打开本轮对决范围，恢复暂停的作品。如果范围没有缩小，可能是最近组合暂时被去重；也可以查看 Tier List 或添加更多作品。",
      canReset: true
    };
  }

  return {
    title: "当前没有足够可匹配的动画",
    description: "可以添加更多作品或查看 Tier List。",
    canReset: false
  };
}
