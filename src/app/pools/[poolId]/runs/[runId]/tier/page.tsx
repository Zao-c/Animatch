"use client";

import { toPng } from "html-to-image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TierAnimeCard } from "@/components/TierAnimeCard";
import { TierExportCanvas } from "@/components/TierExportCanvas";
import { TierSharePanel } from "@/components/TierSharePanel";
import { PageShell } from "@/components/PageShell";
import { RankingProgressCard } from "@/components/RankingProgressCard";
import { StatusHint } from "@/components/StatusHint";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import {
  clearManualTier,
  createRecalibrationSession,
  createTierShare,
  getPool,
  getTierList,
  saveManualTierList,
  type RecalibrationType,
  type TierListItem,
  type TierListResponse
} from "@/lib/client-api";
import {
  buildTierExportFilename,
  formatTierExportTimestamp,
  getTierExportDimensions
} from "@/lib/tier-export";
import {
  DEFAULT_TIER_LABELS,
  readTierLabels,
  resetTierLabels,
  saveTierLabels,
  type TierLabels
} from "@/lib/tier-labels";

const TIERS = ["S", "A", "B", "C", "D"] as const;
type Tier = (typeof TIERS)[number];
type TierMap = Record<Tier, TierListItem[]>;

const TIER_STYLE: Record<Tier, string> = {
  S: "border-anime-pink/35 from-anime-pink/18 via-anime-amber/10",
  A: "border-anime-purple/30 from-anime-purple/16 via-anime-purple/8",
  B: "border-blue-300/25 from-blue-400/14 via-blue-400/6",
  C: "border-emerald-300/22 from-emerald-400/12 via-emerald-400/5",
  D: "border-slate-300/16 from-slate-400/8 via-emerald-400/4"
};

const TIER_LABEL_STYLE: Record<Tier, string> = {
  S: "bg-gradient-to-br from-anime-pink to-anime-amber text-slate-950",
  A: "bg-anime-purple text-slate-950",
  B: "bg-blue-300 text-slate-950",
  C: "bg-emerald-300 text-slate-950",
  D: "bg-slate-500 text-white"
};

const RECALIBRATION_MODES: { type: RecalibrationType; title: string; body: string }[] = [
  { type: "SMART", title: "智能校准", body: "自动挑选最值得复核的组合。" },
  { type: "RANGE", title: "区间校准", body: "围绕某个 Tier 边界做微调。" },
  { type: "FOCUS", title: "焦点校准", body: "指定 1-3 部动画进行重点复核。" }
];

const EXPORT_BACKGROUND = "#101310";
const EXPORT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='448' viewBox='0 0 320 448'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%230f766e' stop-opacity='.65'/%3E%3Cstop offset='1' stop-color='%23312e81' stop-opacity='.65'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='448' fill='%23071121'/%3E%3Crect x='28' y='28' width='264' height='392' rx='24' fill='url(%23g)'/%3E%3Ctext x='160' y='230' text-anchor='middle' fill='%23a5f3fc' font-family='Arial' font-size='28' font-weight='700'%3EAniMatch%3C/text%3E%3C/svg%3E";

export default function TierPage({
  params
}: {
  params: { poolId: string; runId: string };
}) {
  const router = useRouter();
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [poolName, setPoolName] = useState("当前番组");
  const [tierList, setTierList] = useState<TierListResponse | null>(null);
  const [editableTiers, setEditableTiers] = useState<TierMap | null>(null);
  const [dragSource, setDragSource] = useState<{ tier: Tier; animeId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecalibration, setShowRecalibration] = useState(false);
  const [recalibrationType, setRecalibrationType] = useState<RecalibrationType>("SMART");
  const [targetTier, setTargetTier] = useState<Tier>("A");
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
  const [tierLabels, setTierLabels] = useState<TierLabels>(DEFAULT_TIER_LABELS);
  const [draftTierLabels, setDraftTierLabels] = useState<TierLabels>(DEFAULT_TIER_LABELS);
  const [showTierLabelEditor, setShowTierLabelEditor] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
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
      setCanShowCommunityRanking(
        pool.visibility === "PUBLIC" && pool.status !== "ARCHIVED" && pool.deletedAt == null
      );
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
        TIERS.map((tier) => ({
          tier,
          animeIds: editableTiers[tier].map((item) => item.animeId)
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
    if (exportRef.current === null || tierList === null) {
      return;
    }

    setIsExporting(true);
    setExportError(null);
    const generatedAt = new Date();
    setExportedAt(generatedAt);

    try {
      await waitForExportReady(exportRef.current);
      const exportSize = getTierExportDimensions(exportRef.current);
      const dataUrl = await toPng(exportRef.current, {
        backgroundColor: EXPORT_BACKGROUND,
        cacheBust: true,
        width: exportSize.width,
        height: exportSize.height,
        pixelRatio: 2,
        imagePlaceholder: EXPORT_IMAGE_PLACEHOLDER,
        style: {
          width: `${exportSize.width}px`,
          height: `${exportSize.height}px`
        },
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.exportHidden === "true")
      });
      const link = document.createElement("a");
      link.download = buildTierExportFilename(poolName, generatedAt);
      link.href = dataUrl;
      link.click();
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "导出图片失败");
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

    try {
      const result = await createTierShare({
        poolId: params.poolId,
        runId: params.runId,
        tierLabels
      });
      const absoluteUrl = `${window.location.origin}${result.url}`;
      setShareUrl(absoluteUrl);
      try {
        await copyText(absoluteUrl);
        setShareCopied(true);
      } catch {
        setShareCopied(false);
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

    try {
      await copyText(shareUrl);
      setShareCopied(true);
    } catch {
      setShareCopied(false);
    }
  }

  function handleDrop(targetTierName: Tier, beforeAnimeId?: string) {
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

      for (const tier of TIERS) {
        next[tier] = next[tier].filter((item) => item.animeId !== sourceItem.animeId);
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
  const allItems = useMemo(
    () => (tierList === null ? [] : TIERS.flatMap((tier) => tierList.tiers[tier])),
    [tierList]
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
            导出和分享是这个页面的主动作；校准、手动设定和分层标签收进高级控制。
          </p>
        </div>
      </div>

      <AppCard className="mb-6 p-4" variant="focus">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">生成你的榜单作品</h2>
            <p className="mt-1 text-sm text-slate-400">
              自定义 Tier 标签会同步用于页面展示、导出画布和公开分享。
            </p>
          </div>
          <p className="max-w-2xl text-xs leading-5 text-slate-500 lg:col-span-2">
            Tier List 根据你的对决结果生成，可以分享榜单，也可以导出图片。手动调整只影响榜单展示和当前手动排序，不会改写对决历史。
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

      {error ? <ErrorAlert message={error} className="mb-5" /> : null}
      {exportError ? <ErrorAlert message={exportError} className="mb-5" /> : null}
      <TierSharePanel
        shareError={shareError}
        shareUrl={shareUrl}
        shareCopied={shareCopied}
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
            {TIERS.map((tier) => (
              <label key={tier} className="block">
                <span className="text-sm text-slate-300">{tier}</span>
                <input
                  value={draftTierLabels[tier]}
                  onChange={(event) =>
                    setDraftTierLabels((current) => ({
                      ...current,
                      [tier]: event.target.value
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
                onChange={(event) => setTargetTier(event.target.value as Tier)}
                disabled={recalibrationType !== "RANGE"}
                className="anime-field mt-2 disabled:opacity-50"
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
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
              {allItems.map((item) => {
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
                    {item.display?.title ?? item.titleCn ?? item.title}
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

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="信心指数" value={tierList.confidenceScore.toFixed(1)} />
            <Stat label="当前阶段" value={tierList.progress.stageLabel} />
            <Stat
              label="有效对决"
              value={`${tierList.effectiveComparisons}/${tierList.progress.highConfidenceTarget}`}
            />
            <Stat label="总作品" value={String(tierList.totalAnime)} />
          </div>
          <div className="mb-8">
            <RankingProgressCard progress={tierList.progress} compact />
          </div>
          <div className="mb-8 space-y-3">
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

          <div className="space-y-4">
            {TIERS.map((tier) => (
              <section
                key={tier}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(tier)}
                className={`grid gap-4 rounded-2xl border bg-gradient-to-r ${TIER_STYLE[tier]} to-slate-950/46 p-3 backdrop-blur-xl lg:grid-cols-[104px_1fr]`}
              >
                <div className={`flex min-h-24 items-center justify-center rounded-xl border border-white/15 px-3 text-center shadow-anime-panel ${TIER_LABEL_STYLE[tier]}`}>
                  <span className="max-w-full text-2xl font-black leading-tight [overflow-wrap:anywhere]">
                    {tierLabels[tier]}
                  </span>
                </div>
                {visibleTiers[tier].length === 0 ? (
                  <div className="flex min-h-24 items-center rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-4">
                    <p className="text-sm text-slate-500">
                      {tier} Tier 暂无作品。继续对决后作品会自动进入对应区间。
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {visibleTiers[tier].map((item) => (
                      <TierAnimeCard
                        key={item.animeId}
                        item={item}
                        editable={isEditing}
                        scoreDistribution={scoreDistribution}
                        onDragStart={() => setDragSource({ tier, animeId: item.animeId })}
                        onDropBefore={() => handleDrop(tier, item.animeId)}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {visibleTiers ? (
        <div className="tiermaker-export-host" aria-hidden="true">
          <div ref={exportRef}>
            <TierExportCanvas tiers={visibleTiers} labels={tierLabels} />
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function cloneTiers(tiers: TierMap): TierMap {
  return {
    S: [...tiers.S],
    A: [...tiers.A],
    B: [...tiers.B],
    C: [...tiers.C],
    D: [...tiers.D]
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <AppCard className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </AppCard>
  );
}

const fallbackScoreDistribution = {
  count: 0,
  mean: 1500,
  median: 1500,
  std: 120
};

async function waitForExportReady(container: HTMLElement): Promise<void> {
  await waitForPaint();
  await document.fonts?.ready;
  await waitForTierExportImages(container);
  await waitForPaint();
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForTierExportImages(container: HTMLElement): Promise<void> {
  const images = Array.from(
    container.querySelectorAll<HTMLImageElement>("img[data-tier-export-image='true']")
  );

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const cleanup = () => {
            image.removeEventListener("load", handleLoad);
            image.removeEventListener("error", handleError);
          };
          const handleLoad = () => {
            cleanup();
            resolve();
          };
          const handleError = () => {
            cleanup();
            console.warn("Tier export cover failed before capture", {
              animeId: image.dataset.animeId,
              coverUrl: image.currentSrc || image.src
            });
            resolve();
          };

          image.addEventListener("load", handleLoad, { once: true });
          image.addEventListener("error", handleError, { once: true });
        })
    )
  );
}

async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error("Clipboard is not available");
  }

  await navigator.clipboard.writeText(value);
}
