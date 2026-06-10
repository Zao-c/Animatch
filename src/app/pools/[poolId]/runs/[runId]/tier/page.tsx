"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { PageShell } from "@/components/PageShell";
import {
  clearManualTier,
  createRecalibrationSession,
  getTierList,
  saveManualTierList,
  type RecalibrationType,
  type TierListItem,
  type TierListResponse
} from "@/lib/client-api";

const TIERS = ["S", "A", "B", "C", "D"] as const;
type Tier = (typeof TIERS)[number];
type TierMap = Record<Tier, TierListItem[]>;

export default function TierPage({
  params
}: {
  params: { poolId: string; runId: string };
}) {
  const router = useRouter();
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
      const data = await getTierList(params.poolId, params.runId);
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
          <h1 className="text-3xl font-semibold text-white">Tier List</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            手动设定不会删除 Elo，也不会删除对决历史，只影响最终展示和后续口味画像。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/pools/${params.poolId}`}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            返回番组
          </Link>
          <Link
            href={`/pools/${params.poolId}/runs/${params.runId}/match`}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            继续对决
          </Link>
          <button
            onClick={() => setShowRecalibration((value) => !value)}
            className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10"
          >
            校准榜单
          </button>
          {isEditing ? (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200 disabled:opacity-50"
            >
              保存最终设定
            </button>
          ) : (
            <button
              onClick={startEditing}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200"
            >
              编辑最终设定
            </button>
          )}
          <button
            onClick={handleClearManual}
            disabled={isSaving}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            恢复系统排序
          </button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-zinc-400">正在加载榜单...</p> : null}
      {error ? <p className="mb-5 text-sm text-red-300">{error}</p> : null}

      {tierList ? (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="信心指数" value={tierList.confidenceScore.toFixed(1)} />
          <Stat label="总作品" value={String(tierList.totalAnime)} />
          <Stat label="已比较作品" value={String(tierList.comparedAnime)} />
          <Stat label="总对决" value={String(tierList.totalComparisons)} />
        </div>
      ) : null}

      {showRecalibration ? (
        <section className="mb-8 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-5">
          <h2 className="text-lg font-semibold text-white">校准模式</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="text-sm text-zinc-300">模式</span>
              <select
                value={recalibrationType}
                onChange={(event) => setRecalibrationType(event.target.value as RecalibrationType)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              >
                <option value="SMART">智能校准</option>
                <option value="RANGE">区间校准</option>
                <option value="FOCUS">焦点校准</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-zinc-300">目标 Tier</span>
              <select
                value={targetTier}
                onChange={(event) => setTargetTier(event.target.value as Tier)}
                disabled={recalibrationType !== "RANGE"}
                className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-zinc-300">计划场数</span>
              <input
                type="number"
                min={1}
                max={50}
                value={plannedCount}
                onChange={(event) => setPlannedCount(Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              onClick={handleCreateRecalibration}
              disabled={isSaving}
              className="self-end rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200 disabled:opacity-50"
            >
              开始校准
            </button>
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
                    className={`rounded-md border px-3 py-1 text-xs ${
                      selected
                        ? "border-cyan-300 bg-cyan-300 text-zinc-950"
                        : "border-white/15 text-zinc-300"
                    }`}
                  >
                    {item.display?.title ?? item.titleCn ?? item.title}
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {visibleTiers ? (
        <div className="space-y-4">
          {TIERS.map((tier) => (
            <section
              key={tier}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(tier)}
              className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[72px_1fr]"
            >
              <div className="flex h-16 items-center justify-center rounded-lg bg-zinc-950 text-3xl font-bold text-cyan-200">
                {tier}
              </div>
              {visibleTiers[tier].length === 0 ? (
                <div className="flex min-h-32 items-center text-sm text-zinc-500">暂无</div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {visibleTiers[tier].map((item) => (
                    <TierCard
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
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function TierCard({
  item,
  editable,
  onDragStart,
  onDropBefore
}: {
  item: TierListItem;
  editable: boolean;
  onDragStart: () => void;
  onDropBefore: () => void;
}) {
  const title = item.display?.title ?? item.titleCn ?? item.title;
  const coverUrl = item.display?.coverUrl ?? item.imageSmallUrl ?? item.imageMediumUrl ?? item.imageUrl;

  return (
    <div
      draggable={editable}
      onDragStart={onDragStart}
      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
      onDrop={(event) => {
        event.stopPropagation();
        onDropBefore();
      }}
      className={`w-52 shrink-0 rounded-lg border border-white/10 bg-zinc-950/60 p-3 ${
        editable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="flex gap-3">
        <AnimeCover
          src={coverUrl}
          secondarySrc={item.imageSmallUrl ?? item.imageMediumUrl ?? item.imageUrl}
          title={title}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold text-white">{title}</h3>
            {item.manualLocked ? <span className="text-xs text-cyan-300">锁</span> : null}
          </div>
          <p className="mt-2 text-xs text-zinc-400">Elo {item.eloScore.toFixed(1)}</p>
          <p className="mt-1 text-xs text-zinc-500">对决 {item.compareCount}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] text-zinc-400">
        <span>胜 {item.winCount}</span>
        <span>负 {item.lossCount}</span>
        <span>平 {item.drawCount}</span>
        <span>未看 {item.unseenCount}</span>
      </div>
    </div>
  );
}
