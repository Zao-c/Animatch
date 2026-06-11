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
  S: "border-cyan-300/28 from-cyan-300/14",
  A: "border-purple-300/24 from-purple-300/12",
  B: "border-blue-300/20 from-blue-300/10",
  C: "border-emerald-300/18 from-emerald-300/8",
  D: "border-slate-300/14 from-slate-300/6"
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
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [tierLabels, setTierLabels] = useState<TierLabels>(DEFAULT_TIER_LABELS);
  const [draftTierLabels, setDraftTierLabels] = useState<TierLabels>(DEFAULT_TIER_LABELS);
  const [showTierLabelEditor, setShowTierLabelEditor] = useState(false);

  const loadTierList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [pool, data] = await Promise.all([
        getPool(params.poolId),
        getTierList(params.poolId, params.runId)
      ]);
      setPoolName(pool.name);
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
      await waitForExportReady();
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

  return (
    <PageShell>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="tier">Tier Wall</AppBadge>
            <AppBadge tone="status">{poolName}</AppBadge>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Tier List 排名榜单墙
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            手动设定不会删除 Elo 或对决历史，只影响最终展示和后续口味画像。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/pools/${params.poolId}`} className={appButtonClasses({ variant: "ghost" })}>
            返回番组
          </Link>
          <Link href={`/pools/${params.poolId}/runs/${params.runId}/match`} className={appButtonClasses({ variant: "ghost" })}>
            继续对决
          </Link>
          <AppButton onClick={() => setShowRecalibration((value) => !value)} variant="secondary">
            校准榜单
          </AppButton>
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
            variant="ghost"
          >
            {isSharing ? "生成分享链接中..." : "分享榜单"}
          </AppButton>
        </div>
      </div>

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

      <AppCard className="mb-8 p-4">
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

      {showRecalibration ? (
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
                生成时间 {formatTierExportTimestamp(exportedAt ?? new Date())}
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
                className={`grid gap-4 rounded-2xl border bg-gradient-to-r ${TIER_STYLE[tier]} to-slate-950/46 p-4 backdrop-blur-xl lg:grid-cols-[88px_1fr]`}
              >
                <div className="flex h-20 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/72 text-4xl font-black text-cyan-100 shadow-[0_0_32px_rgba(3,218,197,0.12)]">
                  <span className="max-w-full px-2 text-center text-2xl font-black leading-tight [overflow-wrap:anywhere]">
                    {tierLabels[tier]}
                  </span>
                </div>
                {visibleTiers[tier].length === 0 ? (
                  <div className="flex min-h-32 items-center">
                    <EmptyState title={`${tier} Tier 暂无作品`} description="继续对决后作品会自动进入对应区间。" />
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

async function waitForExportReady(): Promise<void> {
  await waitForPaint();
  await document.fonts?.ready;
  await waitForPaint();
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error("Clipboard is not available");
  }

  await navigator.clipboard.writeText(value);
}
