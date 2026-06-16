"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TierAnimeCard } from "@/components/TierAnimeCard";
import { TierSharePanel } from "@/components/TierSharePanel";
import { TierShareCard } from "@/components/TierShareView";
import { PageShell } from "@/components/PageShell";
import { RankingProgressCard } from "@/components/RankingProgressCard";
import { StatusHint } from "@/components/StatusHint";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { getAnimeDisplayTitle } from "@/lib/anime-display";
import { copyToClipboard } from "@/lib/clipboard";
import {
  clearManualTier,
  createRecalibrationSession,
  createTierShare,
  getPool,
  getTierList,
  getTierShare,
  saveManualTierList,
  type RecalibrationType,
  type TierListItem,
  type TierListResponse
} from "@/lib/client-api";
import { isCommunityBattleVisiblePool } from "@/lib/community-battle-visibility";
import { exportShareCardAsPng } from "@/lib/share-export";
import { formatTierExportTimestamp } from "@/lib/tier-export";
import { DEFAULT_TIER_CONFIG, type TierRowConfig } from "@/lib/tier-config";
import {
  DEFAULT_TIER_LABELS,
  readTierLabels,
  resetTierLabels,
  saveTierLabels,
  type TierLabels
} from "@/lib/tier-labels";

function deriveTierStyles(rows: TierRowConfig[]) {
  const labelStyle: Record<string, string> = {};
  const borderStyle: Record<string, string> = {};

  for (const row of rows) {
    const colorVar = `--tier-color-${row.order}`;
    labelStyle[row.id] = `tier-row-bg text-slate-950`;
    borderStyle[row.id] = `border-white/10`;
  }

  return { labelStyle, borderStyle };
}

function cloneTiers(tiers: Record<string, TierListItem[]>): Record<string, TierListItem[]> {
  const result: Record<string, TierListItem[]> = {};
  for (const key of Object.keys(tiers)) {
    result[key] = [...tiers[key]];
  }
  return result;
}

const RECALIBRATION_MODES: { type: RecalibrationType; title: string; body: string }[] = [
  { type: "SMART", title: "智能校准", body: "自动挑选最值得复核的组合。" },
  { type: "RANGE", title: "区间校准", body: "围绕某个 Tier 边界做微调。" },
  { type: "FOCUS", title: "焦点校准", body: "指定 1-3 部动画进行重点复核。" }
];

const fallbackScoreDistribution = {
  count: 0,
  mean: 1500,
  median: 1500,
  std: 120
};

const STALE_THRESHOLD_MS = 60 * 5000;

export default function TierPage({
  params
}: {
  params: { poolId: string; runId: string };
}) {
  const router = useRouter();
  const [poolName, setPoolName] = useState("当前番组");
  const [tierList, setTierList] = useState<TierListResponse | null>(null);
  const [editableTiers, setEditableTiers] = useState<Record<string, TierListItem[]> | null>(null);
  const [dragSource, setDragSource] = useState<{ tier: string; animeId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecalibration, setShowRecalibration] = useState(false);
  const [recalibrationType, setRecalibrationType] = useState<RecalibrationType>("SMART");
  const [targetTier, setTargetTier] = useState<string>("a");
  const [focusIds, setFocusIds] = useState<string[]>([]);
  const [plannedCount, setPlannedCount] = useState(20);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState<Date | null>(null);
  const [exportPreviewedAt, setExportPreviewedAt] = useState<Date | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareCopyFallback, setShareCopyFallback] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareSnapshot, setShareSnapshot] = useState<
    import("@/lib/client-api").PublicTierShare | null
  >(null);
  const exportCardRef = useRef<HTMLDivElement | null>(null);
  const [tierLabels, setTierLabels] = useState<TierLabels>(DEFAULT_TIER_LABELS);
  const [draftTierLabels, setDraftTierLabels] = useState<TierLabels>(DEFAULT_TIER_LABELS);
  const [showTierLabelEditor, setShowTierLabelEditor] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [showTierInfo, setShowTierInfo] = useState(false);
  const [canShowCommunityRanking, setCanShowCommunityRanking] = useState(false);

  const loadTierList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [pool, data] = await Promise.all([
        getPool(params.poolId),
        getTierList(params.poolId, params.runId)
      ]);
      setPoolName(pool.name);
      setCanShowCommunityRanking(isCommunityBattleVisiblePool(pool));
      setTierList(data);
      if (!isEditing) {
        setEditableTiers(cloneTiers(data.tiers));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载 Tier List 失败");
    } finally {
      setIsLoading(false);
    }
  }, [isEditing, params.poolId, params.runId]);

  useEffect(() => {
    void loadTierList();
  }, [loadTierList]);

  useEffect(() => {
    const labels = readTierLabels(params.poolId, params.runId);
    setTierLabels(labels);
    setDraftTierLabels(labels);
  }, [params.poolId, params.runId]);

  useEffect(() => {
    if (tierList !== null && exportPreviewedAt === null) {
      setExportPreviewedAt(new Date());
    }
  }, [exportPreviewedAt, tierList]);

  function startEditing() {
    if (tierList === null) {
      return;
    }

    setEditableTiers(cloneTiers(tierList.tiers));
    setIsEditing(true);
    setError(null);
  }

  function cancelEditing() {
    if (tierList !== null) {
      setEditableTiers(cloneTiers(tierList.tiers));
    }
    setIsEditing(false);
    setError(null);
  }

  async function handleSave() {
    if (editableTiers === null) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const data = await saveManualTierList(
        params.poolId,
        params.runId,
        tierRows.map((row) => ({
          tier: row.id,
          animeIds: (editableTiers[row.id] ?? []).map((item) => item.animeId)
        }))
      );
      setTierList(data);
      setEditableTiers(cloneTiers(data.tiers));
      setIsEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存最终设定失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClearManual() {
    setIsSaving(true);
    setError(null);

    try {
      const data = await clearManualTier(params.poolId, params.runId);
      setTierList(data);
      setEditableTiers(cloneTiers(data.tiers));
      setIsEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "恢复系统排序失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateRecalibration() {
    setIsSaving(true);
    setError(null);

    try {
      const result = await createRecalibrationSession(params.poolId, params.runId, {
        type: recalibrationType,
        targetTier: recalibrationType === "RANGE" ? targetTier : undefined,
        targetAnimeIds: recalibrationType === "FOCUS" ? focusIds.slice(0, 3) : undefined,
        plannedCount
      });
      router.push(
        `/pools/${params.poolId}/runs/${params.runId}/recalibrate/${result.session.id}`
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建校准会话失败");
      setIsSaving(false);
    }
  }

  function openTierLabelEditor() {
    setDraftTierLabels(tierLabels);
    setShowTierLabelEditor(true);
  }

  function handleSaveTierLabels() {
    const labels = saveTierLabels(params.poolId, params.runId, draftTierLabels);
    setTierLabels(labels);
    setDraftTierLabels(labels);
    setShowTierLabelEditor(false);
  }

  function handleResetTierLabels() {
    const labels = resetTierLabels(params.poolId, params.runId);
    setTierLabels(labels);
    setDraftTierLabels(labels);
  }

  async function handleExportImage() {
    if (tierList === null) {
      return;
    }

    setIsExporting(true);
    setExportError(null);
    const generatedAt = new Date();
    setExportedAt(generatedAt);

    try {
      let token = shareToken;

      if (token === null) {
        const result = await createTierShare({
          poolId: params.poolId,
          runId: params.runId,
          tierLabels
        });
        token = result.token;
        setShareToken(token);
        setShareUrl(`${window.location.origin}${result.url}`);
      }

      const share = await getTierShare(token);
      setShareSnapshot(share);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (exportCardRef.current === null) {
        throw new Error("Export card not mounted");
      }

      await exportShareCardAsPng(exportCardRef.current, {
        filename: `animatch-tier-${poolName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").slice(0, 40)}`
      });
    } catch (reason) {
      setExportError(
        reason instanceof Error
          ? `导出图片失败，可以先打开分享链接后手动截图。(${reason.message})`
          : "导出图片失败，可以先打开分享链接后手动截图。"
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleCreateShare() {
    if (tierList === null) {
      return;
    }

    setIsSharing(true);
    setShareError(null);
    setShareCopied(false);
    setShareCopyFallback(false);

    try {
      const result = await createTierShare({
        poolId: params.poolId,
        runId: params.runId,
        tierLabels
      });
      const absoluteUrl = `${window.location.origin}${result.url}`;
      setShareToken(result.token);
      setShareUrl(absoluteUrl);
      const copyResult = await copyToClipboard(absoluteUrl);
      if (copyResult.ok) {
        setShareCopied(true);
        setShareCopyFallback(false);
      } else {
        setShareCopied(false);
        setShareCopyFallback(true);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "请稍后重试。";
      setShareError(`分享链接生成失败：${message}`);
    } finally {
      setIsSharing(false);
    }
  }

  async function handleCopyShareUrl() {
    if (shareUrl === null) {
      return;
    }

    const result = await copyToClipboard(shareUrl);
    if (result.ok) {
      setShareCopied(true);
      setShareCopyFallback(false);
    } else {
      setShareCopied(false);
      setShareCopyFallback(true);
    }
  }

  function handleDrop(targetTierName: string, beforeAnimeId?: string) {
    if (dragSource === null || editableTiers === null) {
      return;
    }

    const sourceItem = editableTiers[dragSource.tier].find(
      (item) => item.animeId === dragSource.animeId
    );

    if (sourceItem === undefined) {
      return;
    }

    setEditableTiers((current) => {
      if (current === null) {
        return current;
      }

      const next = cloneTiers(current);

      for (const row of tierRows) {
        next[row.id] = next[row.id].filter((item) => item.animeId !== sourceItem.animeId);
      }

      const insertIndex =
        beforeAnimeId === undefined
          ? next[targetTierName].length
          : Math.max(
              0,
              next[targetTierName].findIndex((item) => item.animeId === beforeAnimeId)
            );
      next[targetTierName].splice(insertIndex, 0, sourceItem);
      return next;
    });
    setDragSource(null);
  }

  const visibleTiers = editableTiers ?? tierList?.tiers ?? null;
  const tierRows = useMemo(
    () => tierList?.tierRows ?? DEFAULT_TIER_CONFIG.rows,
    [tierList]
  );

  const tierStyles = useMemo(() => deriveTierStyles(tierRows), [tierRows]);

  const allAnime = useMemo(
    () => (tierList === null ? [] : tierRows.flatMap((row) => tierList.tiers[row.id] ?? [])),
    [tierList, tierRows]
  );
  const scoreDistribution = tierList?.scoreDistribution ?? fallbackScoreDistribution;
  const displayedExportedAt = exportedAt ?? exportPreviewedAt;

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="tier">Tier Wall</AppBadge>
            <AppBadge tone="status">{poolName}</AppBadge>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Tier List 排名榜单墙
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            导出和分享是这里的主动作；校准和高级设定默认折叠。
          </p>
        </div>
      </div>

      <AppCard className="mb-6 p-4" variant="focus">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">生成你的榜单作品</h2>
            <p className="mt-1 text-sm text-slate-400">
              导出、分享和继续对决是这个页面的主动作。
            </p>
          </div>
          <p className="max-w-2xl text-xs leading-5 text-slate-500 lg:col-span-2">
            Tier List 根据你的对决结果生成。手动调整只影响榜单展示和当前手动排序，不会改写对决历史。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <AppButton
            onClick={handleExportImage}
            disabled={isExporting || tierList === null}
            variant="primary"
          >
            {isExporting ? "生成中..." : "导出图片"}
          </AppButton>
          <AppButton
            onClick={handleCreateShare}
            disabled={isSharing || tierList === null}
            variant="secondary"
          >
            {isSharing ? "生成分享链接中..." : "分享榜单"}
          </AppButton>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 border-t border-anime-border pt-4">
          <Link href={`/pools/${params.poolId}/runs/${params.runId}/match`} className={appButtonClasses({ variant: "ghost" })}>
            继续对决
          </Link>
          <Link href={`/pools/${params.poolId}`} className={appButtonClasses({ variant: "ghost" })}>
            返回番组
          </Link>
          {canShowCommunityRanking ? (
            <Link
              href={`/pools/${params.poolId}#community-ranking`}
              className={appButtonClasses({ variant: "quiet" })}
            >
              查看社区榜单
            </Link>
          ) : null}
          <AppButton
            onClick={() => setShowAdvancedActions((value) => !value)}
            variant="quiet"
            aria-expanded={showAdvancedActions}
          >
            高级控制
          </AppButton>
        </div>
      </AppCard>

      {canShowCommunityRanking ? (
        <AppCard className="mb-5 p-4" variant="soft">
          <div className="min-w-0">
            <AppBadge tone="source">社区大乱斗</AppBadge>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              这是你的个人榜单；它会以匿名聚合方式参与社区榜单。
            </p>
          </div>
        </AppCard>
      ) : null}

      {error ? <ErrorAlert message={error} className="mb-5" /> : null}
      {exportError ? <ErrorAlert message={exportError} className="mb-5" /> : null}
      <TierSharePanel
        shareError={shareError}
        shareUrl={shareUrl}
        shareCopied={shareCopied}
        shareCopyFallback={shareCopyFallback}
        onCopyShareUrl={handleCopyShareUrl}
      />
      {isLoading ? <ErrorAlert message="正在加载榜单..." tone="notice" className="mb-5" /> : null}
      {isEditing ? (
        <ErrorAlert
          message="正在编辑最终设定，保存后将锁定你的手动排序，但不会删除任何对决历史。"
          tone="warning"
          className="mb-5"
        />
      ) : null}

      {showAdvancedActions ? (
      <AppCard className="mb-8 p-4" variant="soft">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">高级控制</h2>
            <p className="mt-1 text-sm text-slate-400">
              这些操作会影响最终展示或进入校准流程，默认收起以保持榜单墙聚焦。
            </p>
          </div>
          <AppButton onClick={() => setShowRecalibration((value) => !value)} variant="secondary">
            {showRecalibration ? "收起校准" : "校准榜单"}
          </AppButton>
        </div>
        <div className="flex flex-wrap gap-3">
          {isEditing ? (
            <>
              <AppButton onClick={handleSave} disabled={isSaving} variant="primary">
                保存最终设定
              </AppButton>
              <AppButton onClick={cancelEditing} disabled={isSaving} variant="ghost">
                取消编辑
              </AppButton>
            </>
          ) : (
            <AppButton onClick={startEditing} variant="primary">
              编辑最终设定
            </AppButton>
          )}
          <AppButton onClick={handleClearManual} disabled={isSaving} variant="ghost">
            恢复系统排序
          </AppButton>
          <AppButton onClick={openTierLabelEditor} variant="ghost">
            编辑分层标签
          </AppButton>
        </div>
      </AppCard>
      ) : null}

      {showTierLabelEditor ? (
        <AppCard className="mb-8 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <AppBadge tone="source">显示设置</AppBadge>
              <h2 className="mt-3 text-2xl font-black text-white">编辑分层标签</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                仅修改显示名称，不影响 Elo、对决历史和分层排序。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <AppButton onClick={handleSaveTierLabels} variant="primary">
                保存
              </AppButton>
              <AppButton onClick={handleResetTierLabels} variant="ghost">
                重置默认
              </AppButton>
              <AppButton onClick={() => setShowTierLabelEditor(false)} variant="ghost">
                取消
              </AppButton>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            {tierRows.map((row) => (
              <label key={row.id} className="block">
                <span className="text-sm text-slate-300">{row.id}</span>
                <input
                  value={draftTierLabels[row.id] ?? row.label}
                  onChange={(event) =>
                    setDraftTierLabels((current) => ({
                      ...current,
                      [row.id]: event.target.value
                    }))
                  }
                  maxLength={24}
                  className="anime-field mt-2"
                />
              </label>
            ))}
          </div>
        </AppCard>
      ) : null}

      {showAdvancedActions && showRecalibration ? (
        <AppCard className="mb-8 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <AppBadge tone="source">校准实验室</AppBadge>
              <h2 className="mt-3 text-2xl font-black text-white">微调你的榜单边界</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                选择校准方式和计划场数，系统会优先选择分数接近、信息不足或未直接比较过的作品。
              </p>
            </div>
            <AppButton onClick={handleCreateRecalibration} disabled={isSaving} variant="primary">
              开始校准
            </AppButton>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {RECALIBRATION_MODES.map((mode) => {
              const selected = recalibrationType === mode.type;
              return (
                <button
                  key={mode.type}
                  type="button"
                  onClick={() => setRecalibrationType(mode.type)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-cyan-300/50 bg-cyan-300/12 shadow-[0_0_28px_rgba(3,218,197,0.14)]"
                      : "border-white/10 bg-slate-950/42 hover:border-white/20"
                  }`}
                >
                  <h3 className="font-semibold text-white">{mode.title}</h3>
                  <p className="mt-2 text-sm leading-5 text-slate-400">{mode.body}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="text-sm text-slate-300">目标 Tier</span>
              <select
                value={targetTier}
                onChange={(event) => setTargetTier(event.target.value)}
                disabled={recalibrationType !== "RANGE"}
                className="anime-field mt-2 disabled:opacity-50"
              >
                {tierRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">计划场数</span>
              <input
                type="number"
                min={1}
                max={50}
                value={plannedCount}
                onChange={(event) => setPlannedCount(Number(event.target.value))}
                className="anime-field mt-2"
              />
            </label>
          </div>

          {recalibrationType === "FOCUS" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {allAnime.map((item) => {
                const selected = focusIds.includes(item.animeId);
                return (
                  <button
                    key={item.animeId}
                    onClick={() =>
                      setFocusIds((current) =>
                        selected
                          ? current.filter((id) => id !== item.animeId)
                          : current.length >= 3
                            ? current
                            : [...current, item.animeId]
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      selected
                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                        : "border-white/15 text-slate-300 hover:border-cyan-300/35"
                    }`}
                  >
                    {getAnimeDisplayTitle(item)}
                  </button>
                );
              })}
            </div>
          ) : null}
        </AppCard>
      ) : null}

      {tierList && visibleTiers ? (
        <div className="tier-export-surface">
          <div className="tier-export-header mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <AppBadge tone="source">AniMatch</AppBadge>
                <AppBadge tone="tier">Tier Wall</AppBadge>
                <AppBadge tone="status">{poolName}</AppBadge>
              </div>
              <h2 className="tier-export-title mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
                {poolName}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                生成时间 {displayedExportedAt ? formatTierExportTimestamp(displayedExportedAt) : "--"}
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
            <Stat label="信心指数" value={tierList.confidenceScore.toFixed(1)} />
            <Stat label="当前阶段" value={tierList.progress.stageLabel} />
            <Stat
              label="有效对决"
              value={`${tierList.effectiveComparisons}/${tierList.progress.highConfidenceTarget}`}
            />
            <Stat label="总作品" value={String(tierList.totalAnime)} />
          </div>
          <div className="mb-5">
            <RankingProgressCard progress={tierList.progress} compact />
          </div>
          <div className="mb-6">
            <AppButton
              onClick={() => setShowTierInfo((value) => !value)}
              variant="quiet"
              size="sm"
              aria-expanded={showTierInfo}
            >
              {showTierInfo ? "收起说明" : "榜单说明与初始估计"}
            </AppButton>
            {showTierInfo ? (
              <div className="mt-3 space-y-3">
                <StatusHint
                  label="榜单说明"
                  title="系统排序来自两两对决"
                  description="每次选择都会更新作品的相对位置；手动最终设定不会删除对决历史，锁标记代表用户手动确认过最终排序。"
                  tone="guide"
                />
                {tierList.totalComparisons === 0 ? (
                  <StatusHint
                    label="初始估计"
                    title="还没有对决记录"
                    description="当前 Tier List 只是初始估计。完成几轮对决后，分数、分层和信心指数会更准确。"
                    tone="warning"
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {tierRows.map((row) => {
              const rowItems = visibleTiers?.[row.id] ?? [];
              return (
              <section
                key={row.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(row.id)}
                className="grid gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/50 to-slate-950/46 p-3 backdrop-blur-xl lg:grid-cols-[104px_1fr]"
              >
                <div
                  className="flex min-h-24 items-center justify-center rounded-xl border border-white/15 px-3 text-center shadow-anime-panel"
                  style={{ backgroundColor: row.color }}
                >
                  <span className="max-w-full text-2xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere]">
                    {tierLabels[row.id] ?? row.label}
                  </span>
                </div>
                {rowItems.length === 0 ? (
                  <div className="flex min-h-24 items-center rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-4">
                    <p className="text-sm text-slate-500">
                      {row.label} Tier 暂无作品。继续对决后作品会自动进入对应区间。
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {rowItems.map((item) => (
                      <TierAnimeCard
                        key={item.animeId}
                        item={item}
                        editable={isEditing}
                        scoreDistribution={scoreDistribution}
                        onDragStart={() => setDragSource({ tier: row.id, animeId: item.animeId })}
                        onDropBefore={() => handleDrop(row.id, item.animeId)}
                      />
                    ))}
                  </div>
                )}
              </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {visibleTiers ? (
        <div className="tiermaker-export-host" aria-hidden="true">
          <div ref={exportCardRef}>
            {shareSnapshot !== null ? (
              <TierShareCard share={shareSnapshot} exportMode />
            ) : null}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-slate-950/28 px-3 text-xs text-slate-400">
      <span>{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

