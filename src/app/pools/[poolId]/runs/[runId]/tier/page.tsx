"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TierAnimeCard } from "@/components/TierAnimeCard";
import { PageShell } from "@/components/PageShell";
import { StatusHint } from "@/components/StatusHint";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import {
  clearManualTier,
  createRecalibrationSession,
  getPool,
  getTierList,
  saveManualTierList,
  type RecalibrationType,
  type TierListItem,
  type TierListResponse
} from "@/lib/client-api";

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

export default function TierPage({
  params
}: {
  params: { poolId: string; runId: string };
}) {
  const router = useRouter();
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
          <AppButton disabled variant="ghost">
            分享榜单 Coming soon
          </AppButton>
        </div>
      </div>

      {error ? <ErrorAlert message={error} className="mb-5" /> : null}
      {isLoading ? <ErrorAlert message="正在加载榜单..." tone="notice" className="mb-5" /> : null}
      {isEditing ? (
        <ErrorAlert
          message="正在编辑最终设定，保存后将锁定你的手动排序，但不会删除任何对决历史。"
          tone="warning"
          className="mb-5"
        />
      ) : null}

      {tierList ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="信心指数" value={tierList.confidenceScore.toFixed(1)} />
            <Stat label="总作品" value={String(tierList.totalAnime)} />
            <Stat label="已比较作品" value={String(tierList.comparedAnime)} />
            <Stat label="总对决" value={String(tierList.totalComparisons)} />
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
        </>
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
        </div>
      </AppCard>

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

      {visibleTiers ? (
        <div className="space-y-4">
          {TIERS.map((tier) => (
            <section
              key={tier}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(tier)}
              className={`grid gap-4 rounded-2xl border bg-gradient-to-r ${TIER_STYLE[tier]} to-slate-950/46 p-4 backdrop-blur-xl lg:grid-cols-[88px_1fr]`}
            >
              <div className="flex h-20 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/72 text-4xl font-black text-cyan-100 shadow-[0_0_32px_rgba(3,218,197,0.12)]">
                {tier}
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
                      onDragStart={() => setDragSource({ tier, animeId: item.animeId })}
                      onDropBefore={() => handleDrop(tier, item.animeId)}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
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
