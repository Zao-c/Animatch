"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  archivePool,
  createDemoPool,
  getOrCreateDefaultRun,
  listPools,
  restorePool,
  updatePool,
  type PoolManagementStatus,
  type PoolSummary
} from "@/lib/client-api";
import { formatDateTimeStable } from "@/lib/date-format";
import {
  formatOfficialDemo,
  formatPoolManagementStatus,
  formatPoolVisibility,
  POOL_VISIBILITY_OPTIONS,
  type PoolVisibilityValue
} from "@/lib/pool-labels";

type PoolFilter = "ALL" | PoolManagementStatus;
type PoolSort = "UPDATED" | "ANIME_COUNT" | "COMPARISON_COUNT" | "NAME";
type PoolView = "DEFAULT" | "MINE" | "PUBLIC" | "ALL";

const FILTERS: { value: PoolFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "READY", label: "可开始" },
  { value: "IN_PROGRESS", label: "对决中" },
  { value: "STABLE", label: "已稳定" },
  { value: "EMPTY", label: "未添加动画" },
  { value: "ARCHIVED", label: "已归档" }
];

const SORTS: { value: PoolSort; label: string }[] = [
  { value: "UPDATED", label: "最近更新" },
  { value: "ANIME_COUNT", label: "动画数量" },
  { value: "COMPARISON_COUNT", label: "对决数量" },
  { value: "NAME", label: "名称" }
];

export default function PoolsPage() {
  const router = useRouter();
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PoolFilter>("ALL");
  const [sort, setSort] = useState<PoolSort>("UPDATED");
  const [view, setView] = useState<PoolView>("DEFAULT");
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<PoolVisibilityValue>("PRIVATE");
  const [editTags, setEditTags] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPools = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listPools({
        view: view === "DEFAULT" ? undefined : view.toLowerCase() as "mine" | "public" | "all",
        q: query.trim() || undefined,
        status: filter === "ALL" ? undefined : filter,
        includeArchived: filter === "ARCHIVED",
        sort
      });
      setPools(data.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载番组失败");
    } finally {
      setIsLoading(false);
    }
  }, [filter, query, sort, view]);

  useEffect(() => {
    void loadPools();
  }, [loadPools]);

  function beginEdit(pool: PoolSummary) {
    setEditingPoolId(pool.id);
    setEditName(pool.name);
    setEditDescription(pool.description ?? "");
    setEditVisibility(pool.visibility);
    setEditTags(pool.tags.join(", "));
    setError(null);
    setNotice(null);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadPools();
  }

  async function handleSave(poolId: string) {
    if (!editName.trim()) {
      setError("番组名称不能为空");
      return;
    }

    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      await updatePool(poolId, {
        name: editName,
        description: editDescription,
        visibility: editVisibility,
        tags: editTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      setEditingPoolId(null);
      setNotice("番组信息已保存");
      await loadPools();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleArchive(pool: PoolSummary) {
    if (
      !window.confirm(
        "确定归档这个番组吗？归档后它会从默认列表隐藏，历史对决和 Tier List 不会被删除。"
      )
    ) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      await archivePool(pool.id);
      setNotice("番组已归档");
      await loadPools();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "归档失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRestore(pool: PoolSummary) {
    if (!window.confirm("恢复后你可以继续添加动画和对决。")) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      await restorePool(pool.id);
      setNotice("番组已恢复");
      await loadPools();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "恢复失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleCopyPoolId(poolId: string) {
    try {
      await navigator.clipboard?.writeText(poolId);
      setNotice("番组 ID 已复制");
    } catch {
      setError("复制失败，请手动复制番组 ID");
    }
  }

  async function openRun(pool: PoolSummary, target: "match" | "tier") {
    const isArchived = isPoolArchived(pool);
    if (isArchived && pool.defaultRunId == null) {
      return;
    }

    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const runId =
        isArchived && pool.defaultRunId
          ? pool.defaultRunId
          : (await getOrCreateDefaultRun(pool.id)).run.id;
      router.push(`/pools/${pool.id}/runs/${runId}/${target}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "打开榜单失败");
      setIsMutating(false);
    }
  }

  async function handleCreateDemoPool() {
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const result = await createDemoPool();
      router.push(result.redirectTo);
    } catch {
      setError("示例番组创建失败，请稍后重试。");
      setIsMutating(false);
    }
  }

  const hasSearch = query.trim().length > 0;
  const activeCount = pools.filter((pool) => !isPoolArchived(pool)).length;
  const readyCount = pools.filter((pool) => pool.uiStatus === "READY").length;

  return (
    <PageShell>
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <AppBadge tone="source">Pool Control</AppBadge>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            我的番组
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            快速找到、继续或清理测试番组。归档只会隐藏默认列表，不会删除历史对决和 Tier List。
          </p>
        </div>
        <AppCard className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="当前显示" value={String(pools.length)} />
            <Stat label="可开始" value={String(readyCount)} />
            <Stat label="未归档" value={String(activeCount)} />
            <Stat label="筛选" value={FILTERS.find((item) => item.value === filter)?.label ?? "全部"} compact />
          </div>
          <Link
            href="/pools/new"
            className={appButtonClasses({ variant: "primary", className: "mt-4 w-full" })}
          >
            新建番组
          </Link>
        </AppCard>
      </section>

      <AppCard className="mt-7 p-4">
        <form onSubmit={handleSearch} className="grid gap-3 lg:grid-cols-[1fr_160px_180px_180px_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索番组名称或描述"
            className="anime-field"
          />
          <select
            value={view}
            onChange={(event) => setView(event.target.value as PoolView)}
            className="anime-field"
            aria-label="番组视图"
          >
            <option value="DEFAULT">默认</option>
            <option value="MINE">我的番组</option>
            <option value="PUBLIC">公开番组</option>
            <option value="ALL">全部可见</option>
          </select>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as PoolFilter)}
            className="anime-field"
            aria-label="筛选番组状态"
          >
            {FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as PoolSort)}
            className="anime-field"
            aria-label="排序番组"
          >
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <AppButton type="submit" variant="ghost" disabled={isLoading}>
            搜索
          </AppButton>
        </form>
      </AppCard>

      <div className="mt-5 space-y-3">
        {error ? <ErrorAlert message={error} /> : null}
        {notice ? <ErrorAlert message={notice} tone="notice" /> : null}
        {isLoading ? <ErrorAlert message="正在加载番组..." tone="notice" /> : null}
      </div>

      {!isLoading && !error && pools.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={hasSearch ? "没有匹配的番组" : "当前筛选没有番组"}
            description={
              hasSearch
                ? "调整关键词、状态或排序后再试。"
                : filter === "ARCHIVED"
                  ? "还没有归档番组。"
                  : "创建第一个番组，添加动画后就可以开始两两对决。"
            }
            action={
              !hasSearch && filter !== "ARCHIVED" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link href="/pools/new" className={appButtonClasses({ variant: "primary" })}>
                    创建番组
                  </Link>
                  <AppButton
                    type="button"
                    variant="secondary"
                    onClick={handleCreateDemoPool}
                    disabled={isMutating}
                  >
                    {isMutating ? "正在准备体验池..." : "体验示例番组"}
                  </AppButton>
                </div>
              ) : null
            }
          />
        </div>
      ) : null}

      <section className="mt-8">
        <SectionHeader
          eyebrow="Pools"
          title="番组列表"
          description="默认隐藏已归档番组；切到“已归档”可以恢复或查看历史。"
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              isEditing={editingPoolId === pool.id}
              editName={editName}
              editDescription={editDescription}
              editVisibility={editVisibility}
              editTags={editTags}
              isMutating={isMutating}
              onBeginEdit={() => beginEdit(pool)}
              onCancelEdit={() => setEditingPoolId(null)}
              onSave={() => handleSave(pool.id)}
              onArchive={() => handleArchive(pool)}
              onRestore={() => handleRestore(pool)}
              onCopyPoolId={() => handleCopyPoolId(pool.id)}
              onOpenRun={openRun}
              setEditName={setEditName}
              setEditDescription={setEditDescription}
              setEditVisibility={setEditVisibility}
              setEditTags={setEditTags}
            />
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function PoolCard({
  pool,
  isEditing,
  editName,
  editDescription,
  editVisibility,
  editTags,
  isMutating,
  onBeginEdit,
  onCancelEdit,
  onSave,
  onArchive,
  onRestore,
  onCopyPoolId,
  onOpenRun,
  setEditName,
  setEditDescription,
  setEditVisibility,
  setEditTags
}: {
  pool: PoolSummary;
  isEditing: boolean;
  editName: string;
  editDescription: string;
  editVisibility: PoolVisibilityValue;
  editTags: string;
  isMutating: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onCopyPoolId: () => void;
  onOpenRun: (pool: PoolSummary, target: "match" | "tier") => void;
  setEditName: (value: string) => void;
  setEditDescription: (value: string) => void;
  setEditVisibility: (value: PoolVisibilityValue) => void;
  setEditTags: (value: string) => void;
}) {
  const isArchived = isPoolArchived(pool);
  const animeCount = pool.animeCount ?? 0;
  const comparisonCount = pool.comparisonCount ?? 0;
  const confidenceScore = pool.confidenceScore ?? 0;
  const uiStatus = pool.uiStatus ?? (isArchived ? "ARCHIVED" : "EMPTY");
  const statusLabel = pool.uiStatusLabel ?? labelForStatus(uiStatus);
  const canManage = pool.permissions?.canManage ?? true;
  const canAddAnime = pool.permissions?.canAddAnime ?? canManage;
  const canPlay = pool.permissions?.canPlay ?? canManage;
  const canMatch = !isArchived && animeCount >= 2 && canPlay;
  const canPromptLoginToMatch = !isArchived && animeCount >= 2 && !canPlay;
  const canViewTier = pool.defaultRunId != null || !isArchived;
  const officialDemoLabel = formatOfficialDemo(pool.isOfficialDemo);
  const primaryBadgeLabel = officialDemoLabel ?? formatPoolVisibility(pool.visibility);
  const primaryBadgeTone = officialDemoLabel ? "source" : visibilityTone(pool.visibility);

  return (
    <AppCard
      className={`overflow-hidden p-0 transition hover:border-cyan-300/25 ${
        isArchived ? "opacity-70 grayscale-[0.18]" : ""
      }`}
    >
      <CoverStrip images={pool.coverImages ?? []} title={pool.name} />
      <div className="p-5">
      {isEditing ? (
        <div className="space-y-3">
          <input
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            className="anime-field"
            aria-label="番组名称"
          />
          <textarea
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            className="anime-field min-h-24"
            aria-label="番组描述"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={editVisibility}
              onChange={(event) =>
                setEditVisibility(event.target.value as PoolVisibilityValue)
              }
              className="anime-field"
              aria-label="番组可见性"
            >
              {POOL_VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={editTags}
              onChange={(event) => setEditTags(event.target.value)}
              placeholder="标签，逗号分隔"
              className="anime-field"
              aria-label="番组标签"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <AppButton onClick={onSave} disabled={isMutating} variant="primary">
              保存
            </AppButton>
            <AppButton onClick={onCancelEdit} disabled={isMutating} variant="ghost">
              取消
            </AppButton>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/pools/${pool.id}`}
              className="line-clamp-2 text-lg font-semibold text-white transition hover:text-cyan-200"
            >
              {pool.name}
            </Link>
            <AppBadge tone={primaryBadgeTone}>{primaryBadgeLabel}</AppBadge>
          </div>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
            {pool.description ?? "暂无描述"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <AppBadge tone={visibilityTone(pool.visibility)}>
              {formatPoolVisibility(pool.visibility)}
            </AppBadge>
            <AppBadge tone={toneForStatus(uiStatus)}>{statusLabel}</AppBadge>
            <AppBadge tone="source">{pool.sourceType ?? "UNKNOWN"}</AppBadge>
            {isArchived ? <AppBadge tone="danger">ARCHIVED</AppBadge> : null}
          </div>
          {pool.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {pool.tags.slice(0, 4).map((tag) => (
                <AppBadge key={tag} tone="muted">
                  {tag}
                </AppBadge>
              ))}
            </div>
          ) : null}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric label="动画" value={String(animeCount)} />
            <Metric label="对决" value={String(comparisonCount)} />
            <Metric label="信心" value={`${confidenceScore.toFixed(1)}`} />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            更新于 {formatDateTimeStable(pool.updatedAt)}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href={`/pools/${pool.id}`} className={appButtonClasses({ variant: "secondary", size: "sm" })}>
              进入
            </Link>
            {!isArchived && canAddAnime ? (
              <Link href={`/pools/${pool.id}#add-anime`} className={appButtonClasses({ variant: "ghost", size: "sm" })}>
                添加动画
              </Link>
            ) : null}
            {canMatch || canPromptLoginToMatch ? (
              <AppButton
                onClick={() =>
                  canPromptLoginToMatch
                    ? window.location.assign(`/login?next=${encodeURIComponent(`/pools/${pool.id}`)}`)
                    : onOpenRun(pool, "match")
                }
                disabled={isMutating}
                variant={uiStatus === "READY" ? "primary" : "secondary"}
                size="sm"
              >
                {uiStatus === "READY" ? "开始对决" : "继续对决"}
              </AppButton>
            ) : null}
            <AppButton
              onClick={() => onOpenRun(pool, "tier")}
              disabled={isMutating || !canViewTier}
              variant="ghost"
              size="sm"
            >
              查看 Tier
            </AppButton>
          </div>
          {canManage ? (
          <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-semibold text-slate-300">
              更多操作
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <AppButton onClick={onBeginEdit} disabled={isMutating} variant="quiet" size="sm">
                编辑信息
              </AppButton>
              {isArchived ? (
                <AppButton onClick={onRestore} disabled={isMutating} variant="secondary" size="sm">
                  恢复番组
                </AppButton>
              ) : (
                <AppButton onClick={onArchive} disabled={isMutating} variant="danger" size="sm">
                  归档番组
                </AppButton>
              )}
              <AppButton onClick={onCopyPoolId} disabled={isMutating} variant="quiet" size="sm">
                复制番组 ID
              </AppButton>
            </div>
          </details>
          ) : null}
        </>
      )}
      </div>
    </AppCard>
  );
}

function CoverStrip({ images, title }: { images: string[]; title: string }) {
  const visibleImages = images.slice(0, 5);

  if (visibleImages.length === 0) {
    return (
      <div className="grid h-24 grid-cols-5 gap-1 bg-slate-950/45 p-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 via-slate-900 to-anime-purple/25 text-xs font-black text-slate-500"
          >
            {index === 2 ? title.slice(0, 1).toUpperCase() : ""}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-28 grid-cols-5 gap-1 bg-slate-950/45 p-2">
      {visibleImages.map((image, index) => (
        <AnimeCover
          key={`${image}-${index}`}
          src={image}
          title={title}
          size="sm"
          className="h-full w-full rounded-xl"
        />
      ))}
      {Array.from({ length: Math.max(0, 5 - visibleImages.length) }, (_, index) => (
        <div
          key={`fallback-${index}`}
          className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-950"
        />
      ))}
    </div>
  );
}

function isPoolArchived(pool: PoolSummary): boolean {
  return pool.archived === true || pool.status === "ARCHIVED" || pool.deletedAt != null;
}

function visibilityTone(
  visibility: PoolVisibilityValue
): "status" | "success" | "muted" {
  switch (visibility) {
    case "PUBLIC":
      return "success";
    case "UNLISTED":
      return "status";
    case "PRIVATE":
      return "muted";
  }
}

function labelForStatus(status: PoolManagementStatus): string {
  switch (status) {
    case "ARCHIVED":
      return "已归档";
    case "EMPTY":
      return "未添加动画";
    case "READY":
      return "可开始";
    case "IN_PROGRESS":
      return "对决中";
    case "STABLE":
      return "已稳定";
  }
}

function toneForStatus(status: PoolManagementStatus): "status" | "warning" | "danger" | "tier" {
  switch (status) {
    case "ARCHIVED":
      return "danger";
    case "EMPTY":
      return "warning";
    case "READY":
      return "status";
    case "IN_PROGRESS":
      return "tier";
    case "STABLE":
      return "status";
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 font-black text-white ${compact ? "text-xl" : "text-3xl"}`}>{value}</p>
    </div>
  );
}
