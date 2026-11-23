"use client";

import { SeasonCandidatePicker } from "@/components/SeasonCandidatePicker";
import { MatchRecap } from "@/components/MatchRecap";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { PageShell } from "@/components/PageShell";
import { MatchActions, MatchArena, MatchChoiceCard, MatchHeading, MatchWorkspace } from "@/components/MatchPresentation";
import { ApiClientError, getSeasonDetail, getSeasonMatchQueue, setSeasonAnimeHidden, replaceSeasonCandidates, submitSeasonVote } from "@/lib/client-api";
import { getAnimeCoverUrl, getAnimeSourceCoverCandidates } from "@/lib/anime-cover-url";
import { getAnimeDisplayTitle } from "@/lib/anime-display";
import type { SeasonDetail, SeasonMatchQueueItem, SeasonAnimeEntry } from "@/lib/client-api";
import { isInteractiveShortcutTarget } from "@/lib/match-shortcuts";
import { getSeasonScheduleState } from "@/lib/season-schedule";
import { clearPendingSeasonVote, pendingSeasonVoteKey, readPendingSeasonVote, storePendingSeasonVote, type PendingSeasonVote } from "@/lib/pending-season-vote";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

function SeasonDuelCard({ anime, side, disabled, onPick, highlighted }: {
  anime: SeasonAnimeEntry; side: "left" | "right"; disabled: boolean; onPick: () => void; highlighted: boolean;
}) {
  const title = getAnimeDisplayTitle(anime);
  const coverUrl = getAnimeCoverUrl(anime, { intent: "hero" });
  const secondarySrc = anime.imageLargeUrl ?? anime.imageSmallUrl ?? anime.thumbnailUrl ?? anime.imageUrl;
  return <MatchChoiceCard title={title} src={coverUrl} secondarySrc={secondarySrc} fallbackSrcs={getAnimeSourceCoverCandidates(anime)} animeId={anime.animeId} fit="contain" side={side} mode="season" disabled={disabled} onPick={onPick} highlighted={highlighted} details={<p>选择这部作品会消耗 1 张赛季票；跳过和标记没看过不消耗票数。</p>} />;
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

function createVoteMutationId(seasonId: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${seasonId}:${crypto.randomUUID()}`;
  }
  return `${seasonId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function isVoteWriteConflict(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 409;
}

function waitForSeasonFeedback() {
  return wait(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getDailyVotesRemaining(detail: SeasonDetail): number | null {
  if (detail.maxVotesPerUserPerDay === null) return null;
  const dailyVotesUsed = detail.currentUserState?.dailyVotesUsed ?? 0;
  return Math.max(0, detail.maxVotesPerUserPerDay - dailyVotesUsed);
}

function canSubmitSeasonVote(detail: SeasonDetail | null): boolean {
  if (detail === null || !getSeasonScheduleState(detail).canVote) return false;
  const state = detail.currentUserState;
  if (state === null || state.votesRemaining <= 0) return false;
  const dailyVotesRemaining = getDailyVotesRemaining(detail);
  return dailyVotesRemaining === null || dailyVotesRemaining > 0;
}

function SeasonMatchSkeleton() {
  return <div className="mx-auto max-w-6xl animate-pulse px-4 py-8"><div className="h-96 rounded-3xl bg-white/5" /></div>;
}

type SeasonFeedback = "LEFT_WIN" | "RIGHT_WIN" | "SKIP" | "LEFT_UNSEEN" | "RIGHT_UNSEEN" | "BOTH_UNSEEN";

export default function SeasonMatchPage() {
  const { poolId, seasonId } = useParams<{ poolId: string; seasonId: string }>();
  return <SeasonMatchContent key={`${poolId}:${seasonId}`} poolId={poolId} seasonId={seasonId} />;
}

function SeasonMatchContent({ poolId, seasonId }: { poolId: string; seasonId: string }) {
  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [queue, setQueue] = useState<SeasonMatchQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SeasonFeedback | null>(null);
  const [useBias, setUseBias] = useState(false);
  const [voteResult, setVoteResult] = useState<{ stepNumber: number; votesRemaining: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [skippedPairKeys, setSkippedPairKeys] = useState<Set<string>>(new Set());
  const [unseenAnimeIds, setUnseenAnimeIds] = useState<Set<string>>(new Set());
  const [editingCandidates, setEditingCandidates] = useState(false);
  const pickerWasOpen = useRef(false);
  const actionLock = useRef(false);
  const fetching = useRef(false);
  const generation = useRef(0);
  const alive = useRef(false);
  const pendingVote = useRef<PendingSeasonVote | null>(null);
  const inspectedStorageKey = useRef<string | null>(null);
  const [pendingRecord, setPendingRecord] = useState<PendingSeasonVote | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [storageReadFailed, setStorageReadFailed] = useState(false);
  useUnsavedChanges(!!pendingRecord, "上一票还没有确认结果，确定离开？返回后请先确认原票；清除本地记录不会撤销已保存的投票。");

  const fetchData = useCallback(async (skippedPairs: ReadonlySet<string>) => {
    const requestId = ++generation.current;
    fetching.current = true;
    setLoading(true);
    setError(null);
    setQueue([]);
    setCurrentIndex(0);
    try {
      const d = await getSeasonDetail(poolId, seasonId);
      if (!alive.current || requestId !== generation.current) return;
      const serverHidden = new Set(d.currentUserState?.hiddenAnimeIds ?? []);
      setDetail(d);
      setUnseenAnimeIds(serverHidden);
      const storageKey = d.viewerId ? pendingSeasonVoteKey(d.viewerId, poolId, seasonId) : null;
      if (inspectedStorageKey.current !== storageKey) {
        inspectedStorageKey.current = storageKey;
        pendingVote.current = null;
        setPendingRecord(null);
        setStorageWarning(null);
        setStorageReadFailed(false);
        if (d.viewerId) {
          try {
            const stored = readPendingSeasonVote(d.viewerId, poolId, seasonId);
            pendingVote.current = stored;
            setPendingRecord(stored);
          } catch {
            setStorageReadFailed(true);
            setStorageWarning("无法读取本标签页的待确认投票。请先查看赛季榜单，再清除本地记录；当前不会自动重发。");
          }
        }
      }
      // Resolve a stored request before fetching new choices, even after the deadline.
      if (pendingVote.current) return;
      if (!getSeasonScheduleState(d).canVote || !d.currentUserState || !canSubmitSeasonVote(d)) {
        setQueue([]);
        setCurrentIndex(0);
        return;
      }
      const q = await getSeasonMatchQueue(poolId, seasonId, { limit: 5, excludePairKeys: [...skippedPairs] });
      if (!alive.current || requestId !== generation.current) return;
      let filtered = filterSeasonQueue(q, skippedPairs, serverHidden);
      if (filtered.length === 0 && skippedPairs.size > 0) {
        const fallback = await getSeasonMatchQueue(poolId, seasonId, { limit: 5 });
        if (!alive.current || requestId !== generation.current) return;
        setSkippedPairKeys(new Set());
        filtered = filterSeasonQueue(fallback, new Set(), serverHidden);
      }
      setQueue(filtered);
      setCurrentIndex(0);
    } catch (reason) {
      if (alive.current && requestId === generation.current) setError(reason instanceof Error ? reason.message : "加载失败");
    } finally {
      if (alive.current && requestId === generation.current) { fetching.current = false; setLoading(false); }
    }
  }, [poolId, seasonId]);

  useEffect(() => {
    const requestGeneration = generation;
    alive.current = true;
    void fetchData(new Set());
    return () => { alive.current = false; requestGeneration.current++; };
  }, [fetchData]);

  const currentPair = queue[currentIndex] ?? null;
  const busy = loading || submitting;
  const controlsDisabled = busy || !!pendingVote.current || storageReadFailed || editingCandidates;

  useEffect(() => {
    if (editingCandidates) pickerWasOpen.current = true;
    else if (!busy && pickerWasOpen.current) {
      pickerWasOpen.current = false;
      document.getElementById("season-candidate-trigger")?.focus();
    }
  }, [editingCandidates, busy]);

  const beginAction = useCallback(() => {
    if (!alive.current || actionLock.current || fetching.current || pendingVote.current || storageReadFailed || editingCandidates) return false;
    actionLock.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    setVoteResult(null);
    return true;
  }, [editingCandidates, storageReadFailed]);

  const endAction = useCallback(() => {
    actionLock.current = false;
    if (alive.current) { setSubmitting(false); setFeedback(null); }
  }, []);

  const handleRollPair = useCallback(async () => {
    if (!currentPair || !beginAction()) return;
    try {
      setFeedback("SKIP");
      setUseBias(false);
      setVoteResult(null);
      const skipped = new Set(skippedPairKeys).add(seasonMatchPairKey(currentPair));
      setSkippedPairKeys(skipped);
      await waitForSeasonFeedback();
      if (!alive.current) return;
      const filtered = filterSeasonQueue(queue.slice(currentIndex + 1), skipped, unseenAnimeIds);
      setQueue(filtered);
      setCurrentIndex(0);
      if (!filtered.length) await fetchData(skipped);
    } finally { endAction(); }
  }, [currentPair, beginAction, skippedPairKeys, queue, currentIndex, unseenAnimeIds, fetchData, endAction]);

  const handleMarkUnseen = useCallback(async (kind: Extract<SeasonFeedback, "LEFT_UNSEEN" | "RIGHT_UNSEEN" | "BOTH_UNSEEN">) => {
    if (!currentPair || !beginAction()) return;
    try {
      const animeIds = kind === "LEFT_UNSEEN" ? [currentPair.left.animeId] : kind === "RIGHT_UNSEEN" ? [currentPair.right.animeId] : [currentPair.left.animeId, currentPair.right.animeId];
      const result = await setSeasonAnimeHidden(poolId, seasonId, { animeIds, isHidden: true, expectedUserId: detail?.viewerId });
      if (!alive.current) return;
      const hidden = new Set(result.hiddenAnimeIds);
      setUnseenAnimeIds(hidden);
      setDetail((current) => current?.currentUserState ? { ...current, currentUserState: { ...current.currentUserState, hiddenAnimeIds: result.hiddenAnimeIds } } : current);
      setUseBias(false);
      setVoteResult(null);
      setFeedback(kind);
      const skipped = new Set(skippedPairKeys).add(seasonMatchPairKey(currentPair));
      setSkippedPairKeys(skipped);
      await waitForSeasonFeedback();
      if (!alive.current) return;
      const filtered = filterSeasonQueue(queue.slice(currentIndex + 1), skipped, hidden);
      setQueue(filtered);
      setCurrentIndex(0);
      if (!filtered.length) await fetchData(skipped);
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : "排除作品失败，请重试。");
    } finally { endAction(); }
  }, [currentPair, beginAction, poolId, seasonId, detail?.viewerId, skippedPairKeys, queue, currentIndex, fetchData, endAction]);

  async function handleResetUnseen() {
    if (!beginAction()) return;
    try {
      await setSeasonAnimeHidden(poolId, seasonId, { animeIds: [], isHidden: false, expectedUserId: detail?.viewerId });
      if (!alive.current) return;
      setSkippedPairKeys(new Set());
      await fetchData(new Set());
      if (alive.current) setNotice("已恢复全部作品，历史投票保留。");
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : "恢复作品失败");
    } finally { endAction(); }
  }

  async function saveCandidates(includedAnimeIds: string[], expectedHiddenAnimeIds: string[], expectedAnimeIds: string[]) {
    if (actionLock.current || fetching.current || pendingVote.current || !detail?.viewerId) throw new Error("请先等待当前操作完成。");
    actionLock.current = true;
    setSubmitting(true);
    try {
      await replaceSeasonCandidates(poolId, seasonId, { includedAnimeIds, expectedAnimeIds, expectedHiddenAnimeIds, expectedUserId: detail.viewerId });
      if (!alive.current) return;
      setEditingCandidates(false);
      setSkippedPairKeys(new Set());
      await fetchData(new Set());
      if (alive.current) setNotice(`已保存本赛季的候选作品，历史投票保留。`);
    } finally { endAction(); }
  }

  const forgetPendingVote = useCallback((record: PendingSeasonVote) => {
    try {
      clearPendingSeasonVote(record.ownerId, poolId, seasonId, record.request.clientMutationId);
      if (alive.current) setStorageWarning(null);
    } catch {
      if (alive.current) setStorageWarning("服务器结果已确认，但浏览器未能清除恢复记录。刷新后若再次出现原票，可重试确认，不会重复扣票。");
    }
    pendingVote.current = null;
    if (alive.current) setPendingRecord(null);
  }, [poolId, seasonId]);

  const handleVote = useCallback(async (winnerId: string) => {
    if (actionLock.current || fetching.current || editingCandidates || storageReadFailed) return;
    const previous = pendingVote.current;
    if (previous && previous.request.winnerAnimeId !== winnerId) { setError("上一票尚未确认，请先重试原选择。"); return; }
    if (!previous && (!currentPair || !canSubmitSeasonVote(detail))) return;
    if (!detail?.viewerId || (previous && previous.ownerId !== detail.viewerId)) { setError("请登录原账号后重新加载赛季。"); return; }
    const record: PendingSeasonVote = previous ?? {
      version: 1, ownerId: detail.viewerId, poolId, seasonId,
      leftTitle: getAnimeDisplayTitle(currentPair!.left), rightTitle: getAnimeDisplayTitle(currentPair!.right),
      request: {
        leftAnimeId: currentPair!.left.animeId, rightAnimeId: currentPair!.right.animeId,
        winnerAnimeId: winnerId, useBiasVote: detail.mode === "BIAS" && useBias,
        clientMutationId: createVoteMutationId(seasonId), expectedUserId: detail.viewerId
      }
    };
    const request = record.request;
    pendingVote.current = record;
    setPendingRecord(record);
    actionLock.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    setVoteResult(null);
    try { storePendingSeasonVote(record); setStorageWarning(null); }
    catch { setStorageWarning("浏览器无法保存恢复记录。原票目前只保留在本页，请确认结果后再刷新或离开。"); }
    let saved = false;
    try {
      let result = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try { result = await submitSeasonVote(poolId, seasonId, request); break; }
        catch (reason) {
          if (!isVoteWriteConflict(reason) || attempt >= 4) throw reason;
          await wait(120 * attempt);
          if (!alive.current) return;
        }
      }
      if (!result) throw new Error("投票失败，请重试。");
      saved = true;
      forgetPendingVote(record);
      if (!alive.current) return;
      setVoteResult({ stepNumber: result.stepNumber, votesRemaining: result.votesRemaining });
      setFeedback(winnerId === request.leftAnimeId ? "LEFT_WIN" : "RIGHT_WIN");
      const nextDetail: SeasonDetail = { ...detail, currentUserState: detail.currentUserState ? {
        ...detail.currentUserState, ...result.usage
      } : null };
      setDetail(nextDetail);
      const skipped = new Set(skippedPairKeys).add([request.leftAnimeId, request.rightAnimeId].sort().join(":"));
      setSkippedPairKeys(skipped);
      await waitForSeasonFeedback();
      if (!alive.current) return;
      setUseBias(false);
      if (previous || !canSubmitSeasonVote(nextDetail) || currentIndex >= queue.length - 1) await fetchData(skipped);
      else setCurrentIndex((index) => index + 1);
      if (alive.current && previous) setNotice("原投票已确认，票数已同步；同一提交编号不会重复扣票。");
    } catch (reason) {
      if (!alive.current) return;
      // A retry may follow a committed request whose response was lost. Keep it
      // recoverable even if a later request is rejected by auth or access checks.
      if (!previous && reason instanceof ApiClientError && [400, 401, 403, 404, 422].includes(reason.status)) forgetPendingVote(record);
      setError(saved ? "上一票已保存，下一组暂时无法加载。" : reason instanceof Error ? reason.message : "投票失败，请重试原选择。");
    } finally { endAction(); }
  }, [currentPair, editingCandidates, storageReadFailed, detail, useBias, seasonId, poolId, skippedPairKeys, currentIndex, queue.length, fetchData, endAction, forgetPendingVote]);

  async function discardPendingVote() {
    if (actionLock.current || fetching.current || !detail?.viewerId) return;
    if (!window.confirm("清除本标签页的待确认记录？这不会撤销服务器已保存的投票。若原请求仍在处理，它仍可能保存；请先查看榜单，避免重新投同一票。")) return;
    try {
      clearPendingSeasonVote(detail.viewerId, poolId, seasonId);
    } catch {
      setStorageWarning("浏览器仍无法清除本地记录，请允许此网站使用存储后重试。");
      return;
    }
    pendingVote.current = null;
    setPendingRecord(null);
    setStorageReadFailed(false);
    setStorageWarning(null);
    setUseBias(false);
    setVoteResult(null);
    await fetchData(skippedPairKeys);
    if (alive.current) setNotice("本地待确认记录已清除，服务器已保存的投票保留。");
  }

  function reloadQueue() {
    if (actionLock.current || fetching.current || pendingVote.current || editingCandidates) return;
    void fetchData(skippedPairKeys);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!currentPair || controlsDisabled || actionLock.current || fetching.current) return;
      if (isInteractiveShortcutTarget(e.target)) return;
      if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;

      const canUseBiasShortcut =
        detail?.mode === "BIAS" && (detail.currentUserState?.biasVotesRemaining ?? 0) > 0;
      const canUseVoteShortcut = canSubmitSeasonVote(detail);
      let handled = true;
      if (e.key === "ArrowLeft" && canUseVoteShortcut) {
        handleVote(currentPair.left.animeId);
      } else if (e.key === "ArrowRight" && canUseVoteShortcut) {
        handleVote(currentPair.right.animeId);
      } else if (e.key === "ArrowDown") {
        handleRollPair();

      } else if (e.key === "1") {
        handleMarkUnseen("LEFT_UNSEEN");
      } else if (e.key === "2") {
        handleMarkUnseen("RIGHT_UNSEEN");
      } else if (e.key === "3" || e.key === "0") {
        handleMarkUnseen("BOTH_UNSEEN");
      } else if ((e.key === "b" || e.key === "B") && canUseBiasShortcut) {
        setUseBias((prev) => !prev);
      } else {
        handled = false;
      }

      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPair, controlsDisabled, handleVote, detail, handleRollPair, handleMarkUnseen]);

  if (loading && detail === null) return <PageShell><SeasonMatchSkeleton /></PageShell>;
  if (error && detail === null) return <PageShell><main className="mx-auto max-w-6xl px-4 py-8"><AppCard className="p-8 text-center"><h1 className="text-xl font-black text-white">加载失败</h1><p className="mt-2 text-sm text-slate-400">{error}</p><div className="mt-5 flex flex-wrap justify-center gap-3"><AppButton type="button" onClick={reloadQueue} variant="secondary">重新加载对决</AppButton><Link href={`/pools/${poolId}/seasons/${seasonId}`} className="inline-flex min-h-11 items-center text-sm text-amber-200 underline">返回赛季详情</Link></div></AppCard></main></PageShell>;
  if (!detail) return null;

  const cs = detail.currentUserState;
  const schedule = getSeasonScheduleState(detail);
  const isSeasonEnded = schedule.phase === "ENDED";
  const dailyVotesRemaining = getDailyVotesRemaining(detail);
  const hasTotalVotesRemaining = Boolean(cs && cs.votesRemaining > 0);
  const hasDailyVotesRemaining = dailyVotesRemaining === null || dailyVotesRemaining > 0;
  const canVote = canSubmitSeasonVote(detail);
  const progressStatColumns =
    detail.mode === "BIAS"
      ? dailyVotesRemaining === null
        ? "grid-cols-4"
        : "grid-cols-5"
      : dailyVotesRemaining === null
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <PageShell contentClassName="!py-3">
      <MatchWorkspace>
        <MatchHeading mode="season" title={detail.title} backHref={`/pools/${poolId}/seasons/${seasonId}`} description="限量投票，和群友一起选出本季最喜欢的作品。" context={<AppBadge tone={schedule.canVote ? "success" : "muted"}>{schedule.canVote ? "开放中" : schedule.phase === "CLOSED" || schedule.phase === "ENDED" ? "投票已结束" : "等待开放"}</AppBadge>} tools={<><Link href={`/pools/${poolId}/seasons/${seasonId}#personal`} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-amber-100">查看赛季榜单</Link>            {unseenAnimeIds.size > 0 ? (
              <button
                type="button"
                onClick={handleResetUnseen}
                disabled={controlsDisabled}
                className="min-h-11 rounded-full border border-amber-300/20 bg-amber-300/5 px-4 text-sm font-semibold text-amber-100 transition hover:border-amber-200/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                恢复已排除 {unseenAnimeIds.size} 部
              </button>
            ) : null}
{schedule.canVote && cs && <AppButton id="season-candidate-trigger" size="sm" variant="secondary" disabled={controlsDisabled} onClick={() => setEditingCandidates(true)}>选择熟悉的作品</AppButton>}
</>} />
        {editingCandidates && detail.viewerId && <SeasonCandidatePicker poolId={poolId} seasonId={seasonId} ownerId={detail.viewerId} onSave={saveCandidates} onClose={() => { if (!actionLock.current) { setEditingCandidates(false); void fetchData(skippedPairKeys); } }} />}
        {notice && <p role="status" className="my-2 text-sm text-cyan-200">{notice}</p>}
        {storageWarning && <div role="alert" className="my-3 rounded-xl border border-amber-300/25 p-4 text-sm text-amber-100"><p>{storageWarning}</p>{storageReadFailed && <AppButton className="mt-3" size="sm" variant="secondary" disabled={busy} onClick={discardPendingVote}>清除本地记录并同步</AppButton>}</div>}
        {pendingRecord && !submitting && <AppCard className="my-3 p-4" role="status">
          <h2 className="font-bold text-amber-100">有一票尚待确认</h2>
          <p className="mt-2 break-words text-sm text-slate-300">{pendingRecord.leftTitle} vs {pendingRecord.rightTitle}</p>
          <p className="mt-2 break-words text-sm text-white">原选择：{pendingRecord.request.winnerAnimeId === pendingRecord.request.leftAnimeId ? pendingRecord.leftTitle : pendingRecord.rightTitle} · {pendingRecord.request.useBiasVote ? "私心票" : "普通票"}</p>
          <p className="mt-2 text-sm text-slate-400">确认会按原编号重试：已保存则返回原结果，未保存且仍可投票时提交原选择。不会重复扣票，也不会自动重发。</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <AppButton disabled={busy} onClick={() => void handleVote(pendingRecord.request.winnerAnimeId)}>确认原投票并继续</AppButton>
            <AppButton variant="secondary" disabled={busy} onClick={discardPendingVote}>清除本地记录</AppButton>
          </div>
        </AppCard>}

        {error ? (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium">{error}</p>
            {pendingVote.current ? null : <AppButton type="button" onClick={reloadQueue} variant="secondary" size="sm" disabled={controlsDisabled}>{loading ? "正在重新加载…" : "重新获取对局"}</AppButton>}
          </div>
        ) : null}

        {cs ? (
          <div className={`mt-3 grid gap-2 text-[11px] sm:mt-4 sm:text-sm ${progressStatColumns}`}>
            <span className="rounded-xl border border-white/10 bg-white/[0.025] px-1.5 py-2 text-center sm:px-3">
              <span className="text-slate-400 sm:text-xs"><span className="sm:hidden">投</span><span className="hidden sm:inline">已投</span></span> <strong className="text-white">{cs.votesUsed}</strong>
            </span>
            <span className="rounded-xl border border-white/10 bg-white/[0.025] px-1.5 py-2 text-center sm:px-3">
              <span className="text-slate-400 sm:text-xs">剩余</span> <strong className="text-amber-200">{cs.votesRemaining}</strong>
            </span>
            {dailyVotesRemaining !== null ? (
              <span className="rounded-xl border border-white/10 bg-white/[0.025] px-1.5 py-2 text-center sm:px-3">
                <span className="text-slate-400 sm:text-xs"><span className="sm:hidden">今日</span><span className="hidden sm:inline">今日剩余</span></span> <strong className={dailyVotesRemaining > 0 ? "text-cyan-200" : "text-amber-200"}>{dailyVotesRemaining}</strong>
              </span>
            ) : null}
            {detail.mode === "BIAS" ? (
              <>
                <span className="rounded-xl border border-white/10 bg-white/[0.025] px-1.5 py-2 text-center sm:px-3">
                  <span className="text-slate-400 sm:text-xs"><span className="sm:hidden">心用</span><span className="hidden sm:inline">私心已用</span></span> <strong className="text-rose-300">{cs.biasVotesUsed}</strong>
                </span>
                <span className="rounded-xl border border-white/10 bg-white/[0.025] px-1.5 py-2 text-center sm:px-3">
                  <span className="text-slate-400 sm:text-xs"><span className="sm:hidden">心剩</span><span className="hidden sm:inline">私心剩余</span></span> <strong className="text-rose-300">{cs.biasVotesRemaining}</strong>
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        {pendingRecord && !currentPair ? (submitting ? <p role="status" className="py-8 text-center text-slate-300">正在确认原投票，请稍候…</p> : null) : schedule.phase === "UPCOMING" || schedule.phase === "DRAFT" || schedule.phase === "CLOSED" || isSeasonEnded ? (
          <AppCard className="mt-8 p-6 text-center">
            <AppBadge tone={schedule.phase === "UPCOMING" || schedule.phase === "DRAFT" ? "warning" : "muted"}>
              {schedule.phase === "UPCOMING" || schedule.phase === "DRAFT" ? "等待开放" : schedule.phase === "CLOSED" ? "投票已截止" : "赛季已结束"}
            </AppBadge>
            <h2 className="mt-4 text-xl font-black text-white">
              {schedule.phase === "UPCOMING" || schedule.phase === "DRAFT" ? "赛季还未开放投票" : "投票已关闭"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {schedule.phase === "UPCOMING"
                ? `将于 ${new Date(detail.startsAt).toLocaleString("zh-CN")} 开放投票。`
                : schedule.phase === "DRAFT"
                  ? "管理员发布赛季后即可按设定时间开放投票。"
                  : `共 ${detail.totalVotes} 票 · ${detail.participantCount} 人参与`}
            </p>
            <Link href={`/pools/${poolId}/seasons/${seasonId}`} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-amber-200 underline">
              返回赛季详情查看结果
            </Link>
          </AppCard>
        ) : !cs ? (
          <AppCard className="mt-8 p-6 text-center"><h2 className="text-xl font-bold">登录后参与赛季投票</h2><p className="mt-2 text-sm text-slate-400">票数和候选作品会保存到你的账号。</p><Link href={`/login?next=${encodeURIComponent(`/pools/${poolId}/seasons/${seasonId}/match`)}`} className="mt-4 inline-flex min-h-11 items-center text-amber-200 underline">登录并继续</Link></AppCard>
        ) : !canVote && cs ? (
          <AppCard className="mt-8 p-6 text-center">
            <h2 className="text-xl font-black text-white">
              {!hasTotalVotesRemaining
                ? "投票次数已用完"
                : !hasDailyVotesRemaining
                  ? "今日票数已用完"
                  : "暂时不能投票"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {!hasTotalVotesRemaining
                ? `你已完成 ${cs.votesUsed} 次投票`
                : !hasDailyVotesRemaining && detail.maxVotesPerUserPerDay !== null
                  ? `今天已投 ${cs.dailyVotesUsed ?? detail.maxVotesPerUserPerDay} / ${detail.maxVotesPerUserPerDay} 票，明天可以继续。`
                  : "请稍后刷新赛季状态后再试。"}
            </p>
          </AppCard>
        ) : loading ? <div role="status" className="py-8 text-center text-slate-300">正在准备下一组…</div> : currentPair ? (
          <div className="mt-2 sm:mt-4">
            {detail.mode === "BIAS" && cs && cs.biasVotesRemaining > 0 ? (
              <div className="mb-2 flex items-center justify-center sm:mb-4">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/5 px-3 py-2 text-xs text-rose-200 select-none sm:px-4 sm:text-sm">
                  <input
                    type="checkbox"
                    checked={useBias}
                    disabled={controlsDisabled}
                    onChange={(e) => setUseBias(e.target.checked)}
                    className="h-4 w-4 rounded accent-rose-400"
                  />
                  <span><span className="sm:hidden">私心票加成 · 剩余 {cs.biasVotesRemaining}</span><span className="hidden sm:inline">使用私心票 (共享榜单加成, 剩余 {cs.biasVotesRemaining})</span></span>
                  <span className="ml-1 hidden text-xs text-slate-500 sm:inline">按 B 切换</span>
                </label>
              </div>
            ) : null}

            <MatchArena mode="season"
              left={<SeasonDuelCard key={currentPair.left.animeId + String(currentIndex)} anime={currentPair.left} side="left" disabled={controlsDisabled} onPick={() => handleVote(currentPair.left.animeId)} highlighted={feedback === "LEFT_WIN"} />}
              right={<SeasonDuelCard key={currentPair.right.animeId + String(currentIndex)} anime={currentPair.right} side="right" disabled={controlsDisabled} onPick={() => handleVote(currentPair.right.animeId)} highlighted={feedback === "RIGHT_WIN"} />}
            />
            <MatchActions disabled={controlsDisabled} onSkip={handleRollPair} onUnseen={handleMarkUnseen} hint="跳过只更换当前对局，不计票；没看过的作品从赛季候选池隐藏，可在赛季详情恢复。" />
            <p className="mt-2 text-center text-xs text-slate-400">本批投完会自动获取下一批作品，直到你的票数用完。</p>
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
                  <AppButton variant="secondary" onClick={handleResetUnseen} disabled={controlsDisabled}>
                    恢复已排除作品
                  </AppButton>
                ) : null}
                <AppButton
                  variant="primary"
                  onClick={reloadQueue}
                  disabled={controlsDisabled}
                >
                  获取下一批作品
                </AppButton>
              </div>
            ) : null}
          </AppCard>
        )}
        <div className="mt-2 min-h-[34px] sm:mt-4 sm:min-h-[42px]" aria-live="polite" aria-atomic="true">
          {voteResult ? (
            <div
              role="status"
              className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-1.5 text-sm text-amber-200 sm:px-4 sm:py-2"
            >
              已投票！第 {voteResult.stepNumber} 票 · 剩余 {voteResult.votesRemaining} 票
            </div>
          ) : null}
        </div>

        <div className="mt-4"><MatchRecap count={detail.currentUserState?.votesUsed ?? 0} scopeKey={`${detail.viewerId ?? "guest"}:${seasonId}`} endpoint={`/api/pools/${poolId}/seasons/${seasonId}`} resultHref={`/pools/${poolId}/seasons/${seasonId}#personal`} season /></div>
      </MatchWorkspace>
    </PageShell>
  );
}
