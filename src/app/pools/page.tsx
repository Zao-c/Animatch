"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
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
import { copyTextWithFallback } from "@/lib/browser-copy";
import {
  formatOfficialDemo,
  formatPoolVisibility,
  POOL_VISIBILITY_OPTIONS,
  type PoolVisibilityValue
} from "@/lib/pool-labels";
import { labelAnimeTag } from "@/lib/anime-tag-dictionary";

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
  return (
    <Suspense fallback={<PoolsPageFallback />}>
      <PoolsPageContent />
    </Suspense>
  );
}

function PoolsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [appliedQuery, setAppliedQuery] = useState(() => (searchParams.get("q") ?? "").trim());
  const [filter, setFilter] = useState<PoolFilter>(() => parsePoolFilter(searchParams.get("status")));
  const [sort, setSort] = useState<PoolSort>(() => parsePoolSort(searchParams.get("sort")));
  const [view, setView] = useState<PoolView>(() => parsePoolView(searchParams.get("view")));
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<PoolVisibilityValue>("PRIVATE");
  const [editTags, setEditTags] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [openingPoolId, setOpeningPoolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const loadPools = useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const data = await listPools({
        view: view === "DEFAULT" ? undefined : view.toLowerCase() as "mine" | "public" | "all",
        q: appliedQuery || undefined,
        status: filter === "ALL" ? undefined : filter,
        includeArchived: filter === "ARCHIVED",
        sort
      });
      if (requestId === latestRequestRef.current) {
        setPools(data.items);
      }
    } catch (reason) {
      if (requestId === latestRequestRef.current) {
        setError(reason instanceof Error ? reason.message : "加载番组失败");
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [appliedQuery, filter, sort, view]);

  useEffect(() => {
    void loadPools();
  }, [loadPools]);

  useEffect(() => {
    setView(parsePoolView(searchParams.get("view")));
    setQuery(searchParams.get("q") ?? "");
    setAppliedQuery((searchParams.get("q") ?? "").trim());
    setFilter(parsePoolFilter(searchParams.get("status")));
    setSort(parsePoolSort(searchParams.get("sort")));
  }, [searchParams]);

  function updateListParams(changes: Record<string, string | undefined>) {
    const nextParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
    }
    const nextQuery = nextParams.toString();
    router.replace(`/pools${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
  }

  function resetFilters() {
    setQuery("");
    updateListParams({ q: undefined, status: undefined });
  }

  function beginEdit(pool: PoolSummary) {
    setEditingPoolId(pool.id);
    setEditName(pool.name);
    setEditDescription(pool.description ?? "");
    setEditVisibility(pool.visibility);
    setEditTags(pool.tags.join(", "));
    setError(null);
    setNotice(null);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery === appliedQuery) {
      void loadPools();
      return;
    }
    updateListParams({ q: nextQuery || undefined });
  }

  function handleViewChange(nextView: PoolView) {
    updateListParams({ view: poolViewToQueryValue(nextView) });
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
    const result = await copyTextWithFallback(poolId);
    if (result === "copied") {
      setNotice("番组 ID 已复制");
    } else {
      setError(`自动复制失败，请手动复制番组 ID：${poolId}`);
    }
  }

  async function openRun(pool: PoolSummary, target: "match" | "tier") {
    if (isMutating) return;
    const isArchived = isPoolArchived(pool);
    if (isArchived && pool.defaultRunId == null) {
      return;
    }

    setIsMutating(true);
    setOpeningPoolId(pool.id);
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
      setOpeningPoolId(null);
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

  const hasSearch = appliedQuery.length > 0;
  const hasFilters = hasSearch || filter !== "ALL";
  const playableCount = pools.filter(
    (pool) => !isPoolArchived(pool) && (pool.animeCount ?? 0) >= 2
  ).length;
  const isPublicView = view === "PUBLIC";
  const viewCopy = getPoolViewCopy(view);

  return (
    <PageShell>
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {viewCopy.title}
          </h1>
        </div>
        <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          {isLoading ? "正在加载番组…" : <>
          <span className="font-black text-white">{String(pools.length)}</span> 个番组
          <span className="text-slate-500">·</span>
          <span className="font-black text-emerald-200">{String(playableCount)}</span> 可对决
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">筛选 {FILTERS.find((item) => item.value === filter)?.label ?? "全部"}</span>
          </>}
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/22 p-3">
        <form role="search" onSubmit={handleSearch} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索番组名称或描述"
            aria-label="搜索番组名称或描述"
            className="anime-field"
          />
          <AppButton type="submit" variant="ghost" disabled={isLoading}>
            搜索
          </AppButton>
          <details className="col-span-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-slate-300">筛选与排序 · {viewCopy.title} · {FILTERS.find((item) => item.value === filter)?.label} · {SORTS.find((item) => item.value === sort)?.label}</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <select
            value={view}
            onChange={(event) => handleViewChange(event.target.value as PoolView)}
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
            onChange={(event) => updateListParams({ status: event.target.value === "ALL" ? undefined : event.target.value })}
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
            onChange={(event) => updateListParams({ sort: event.target.value === "UPDATED" ? undefined : event.target.value })}
            className="anime-field"
            aria-label="排序番组"
          >
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
            </div>
          </details>
        </form>
        {hasFilters ? <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
          <p className="min-w-0 flex-1 break-words text-xs text-slate-300">
            {hasSearch ? `关键词：${appliedQuery}` : ""}{hasSearch && filter !== "ALL" ? " · " : ""}{filter !== "ALL" ? `状态：${FILTERS.find((item) => item.value === filter)?.label}` : ""}
          </p>
          <AppButton type="button" variant="quiet" size="sm" onClick={resetFilters}>清除筛选</AppButton>
        </div> : null}
      </div>

      <div className="mt-5 space-y-3">
        {error ? <div className="space-y-2"><ErrorAlert message={error} /><AppButton type="button" variant="ghost" onClick={() => void loadPools()} disabled={isLoading}>重新加载番组</AppButton></div> : null}
        {notice ? <ErrorAlert message={notice} tone="notice" /> : null}
      </div>

      {!isLoading && !error && pools.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={
              hasFilters
                ? "没有匹配的番组"
                : isPublicView
                  ? "暂无公开番组"
                  : "当前筛选没有番组"
            }
            description={
              hasFilters
                ? filter === "ARCHIVED" && !hasSearch
                  ? "还没有归档番组。清除筛选可以回到当前列表。"
                  : "试试其他关键词，或清除筛选查看这个列表中的全部番组。"
                : isPublicView
                  ? "公开番组开放后会出现在这里；你可以稍后再来，或切回我的番组。"
                  : "创建第一个番组，添加动画后就可以开始两两对决。"
            }
            action={
              hasFilters ? (
                <AppButton type="button" variant="secondary" onClick={resetFilters}>清除筛选，查看全部</AppButton>
              ) : isPublicView ? (
                <button
                  type="button"
                  onClick={() => handleViewChange("MINE")}
                  className={appButtonClasses({ variant: "secondary" })}
                >
                  查看我的番组
                </button>
              ) : (
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
              )
            }
          />
        </div>
      ) : null}

      <section className="mt-5" aria-label={isPublicView ? "发现公开番组" : "番组列表"} aria-busy={isLoading}>
        <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${isLoading && pools.length > 0 ? "opacity-60" : ""}`}>
          {isLoading && pools.length === 0 ? Array.from({ length: 3 }, (_, index) => (
            <AppCard key={index} className="overflow-hidden p-0" aria-hidden="true">
              <div className="h-28 animate-pulse bg-white/[0.06]" />
              <div className="space-y-4 p-5"><div className="h-6 w-2/3 rounded bg-white/[0.08]" /><div className="h-4 rounded bg-white/[0.04]" /><div className="h-11 rounded-xl bg-white/[0.06]" /></div>
            </AppCard>
          )) : null}
          {pools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              isPublicView={isPublicView}
              isEditing={editingPoolId === pool.id}
              editName={editName}
              editDescription={editDescription}
              editVisibility={editVisibility}
              editTags={editTags}
              isMutating={isMutating || isLoading}
              isOpening={openingPoolId === pool.id}
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

function PoolsPageFallback() {
  return (
    <PageShell>
      <ErrorAlert message="正在加载番组..." tone="notice" />
    </PageShell>
  );
}

function PoolCard({
  pool,
  isPublicView,
  isEditing,
  editName,
  editDescription,
  editVisibility,
  editTags,
  isMutating,
  isOpening,
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
  isPublicView: boolean;
  isEditing: boolean;
  editName: string;
  editDescription: string;
  editVisibility: PoolVisibilityValue;
  editTags: string;
  isMutating: boolean;
  isOpening: boolean;
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
  const globalComparisonCount = pool.globalComparisonCount ?? pool.comparisonCount ?? 0;
  const hasPersonalProgress = pool.personalComparisonCount !== undefined && pool.personalComparisonCount !== null;
  const comparisonCount = hasPersonalProgress
    ? pool.personalComparisonCount ?? 0
    : globalComparisonCount;
  const confidenceScore = hasPersonalProgress
    ? pool.personalConfidenceScore ?? 0
    : pool.confidenceScore ?? 0;
  const comparisonLabel = hasPersonalProgress
    ? `我已 ${comparisonCount} 次有效对决`
    : `社区累计 ${comparisonCount} 次有效对决`;
  const confidenceLabel = hasPersonalProgress ? "我的榜单稳定度" : "社区榜单稳定度";
  const uiStatus = pool.uiStatus ?? (isArchived ? "ARCHIVED" : "EMPTY");
  const statusLabel = pool.uiStatusLabel ?? labelForStatus(uiStatus);
  const canManage = pool.permissions?.canManage ?? true;
  const canAddAnime = pool.permissions?.canAddAnime ?? canManage;
  const canPlay = pool.permissions?.canPlay ?? canManage;
  const canMatch = !isArchived && animeCount >= 2 && canPlay;
  const canPromptLoginToMatch = !isArchived && animeCount >= 2 && !canPlay;
  const canViewTier = pool.defaultRunId != null || !isArchived;
  const officialDemoLabel = formatOfficialDemo(pool.isOfficialDemo);

  return (
    <AppCard
      className={`flex h-full flex-col overflow-hidden p-0 transition hover:border-cyan-300/25 ${
        isArchived ? "opacity-70 grayscale-[0.18]" : ""
      }`}
    >
      <CoverStrip
        images={pool.coverImages ?? []}
        fallbacks={pool.coverImageFallbacks ?? []}
        title={pool.name}
      />
      <div className="flex flex-1 flex-col p-5">
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
            {officialDemoLabel ? <AppBadge tone="source">{officialDemoLabel}</AppBadge> : null}
          </div>
          {!officialDemoLabel ? (
            <div className="flex flex-wrap gap-2">
              <AppBadge tone={visibilityTone(pool.visibility)}>
                {formatPoolVisibility(pool.visibility)}
              </AppBadge>
              {isPublicView && pool.visibility === "PUBLIC" && !isArchived ? (
                <AppBadge tone="status">开放参与</AppBadge>
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
            {pool.description ?? "暂无描述"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!isPublicView ? <AppBadge tone={toneForStatus(uiStatus)}>{statusLabel}</AppBadge> : null}
            {animeCount > 0 ? (
              <AppBadge tone="muted">{animeCount} 部动画</AppBadge>
            ) : null}
            {!isPublicView && comparisonCount > 0 ? (
              <AppBadge tone="muted">{comparisonLabel}</AppBadge>
            ) : null}
            {!isPublicView && isArchived ? <AppBadge tone="danger">已归档</AppBadge> : null}
          </div>
          {isPublicView && pool.visibility === "PUBLIC" && pool.communitySummary ? (
            <div className="mt-3 border-t border-white/10 pt-3">
              {pool.communitySummary.sampleLabel === "empty" ? (
                <p className="text-xs leading-5 text-slate-500">
                  还没有社区结果。成为第一个参与的人。
                </p>
              ) : (
                <>
                  {pool.communitySummary.topAnimeTitle ? (
                    <div className="flex items-start gap-2">
                      <AnimeCover
                        src={pool.communitySummary.topAnimeImageUrl}
                        title={pool.communitySummary.topAnimeTitle}
                        size="sm"
                        className="h-16 w-11 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-400">
                          {communitySummaryTitle(pool.communitySummary.sampleLabel)}
                        </p>
                        <p className="line-clamp-2 text-xs font-semibold text-white">
                          {pool.communitySummary.topAnimeTitle}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {pool.communitySummary.participantCount} 人参与
                          {sampleLabelText(pool.communitySummary.sampleLabel)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs leading-5 text-slate-400">
                      {pool.communitySummary.participantCount} 人参与 · {sampleLabelText(pool.communitySummary.sampleLabel)}
                    </p>
                  )}
                </>
              )}
            </div>
          ) : null}

          <div className="mt-auto pt-4">
            <div className={`grid gap-2 ${canMatch || canPromptLoginToMatch ? "grid-cols-2" : "grid-cols-1"}`}>
              <Link href={`/pools/${pool.id}`} className={appButtonClasses({ variant: canMatch || canPromptLoginToMatch ? "ghost" : "primary", size: "md", className: "w-full min-w-0 px-2" })}>
                番组详情
              </Link>
            {canMatch || canPromptLoginToMatch ? (
              <AppButton
                onClick={() =>
                  canPromptLoginToMatch
                    ? window.location.assign(`/login?next=${encodeURIComponent(`/pools/${pool.id}`)}`)
                    : onOpenRun(pool, "match")
                }
                disabled={isMutating}
                variant="primary"
                size="md"
                className="w-full min-w-0 px-2"
              >
                {isOpening ? "正在进入…" : isPublicView && pool.visibility === "PUBLIC"
                  ? canPromptLoginToMatch
                    ? "登录后对决"
                    : "个人自由对决"
                  : uiStatus === "READY"
                    ? "开始对决"
                    : "继续对决"}
              </AppButton>
            ) : null}
            </div>
          </div>
          <details className="mt-3 rounded-xl border border-white/10 bg-slate-950/24 px-3 py-2">
            <summary className="min-h-11 cursor-pointer select-none py-3 text-sm font-semibold text-slate-300">
              更多操作
            </summary>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              更新于 {formatDateTimeStable(pool.updatedAt)}
              {confidenceScore > 0 ? ` · ${confidenceLabel} ${confidenceScore.toFixed(1)}` : ""}
            </p>
            {pool.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {pool.tags.slice(0, 4).map((tag) => (
                  <AppBadge key={tag} tone="muted">
                    {labelAnimeTag(tag)}
                  </AppBadge>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {!isPublicView && !isArchived && canAddAnime ? (
                <Link href={`/pools/${pool.id}#add-anime`} className={appButtonClasses({ variant: "ghost", size: "sm" })}>
                  添加动画
                </Link>
              ) : null}
              <AppButton
                onClick={() => onOpenRun(pool, "tier")}
                disabled={isMutating || !canViewTier}
                variant="ghost"
                size="sm"
              >
                查看 Tier
              </AppButton>
              {canManage ? (
                <>
                  <AppButton onClick={onBeginEdit} disabled={isMutating} variant="quiet" size="sm">
                    番组设置
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
                </>
              ) : null}
            </div>
          </details>
        </>
      )}
      </div>
    </AppCard>
  );
}

function CoverStrip({
  images,
  fallbacks,
  title
}: {
  images: string[];
  fallbacks: (string | null | undefined)[];
  title: string;
}) {
  const visibleImages = images.slice(0, 5);

  if (visibleImages.length === 0) {
    return (
      <div className="grid h-28 grid-cols-5 gap-1 bg-slate-950/45 p-2">
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
          secondarySrc={fallbacks[index] ?? null}
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

function parsePoolView(value: string | null): PoolView {
  switch (value?.trim().toLowerCase()) {
    case "mine":
      return "MINE";
    case "public":
      return "PUBLIC";
    case "all":
      return "ALL";
    default:
      return "DEFAULT";
  }
}

function parsePoolFilter(value: string | null): PoolFilter {
  return FILTERS.find((item) => item.value === value)?.value ?? "ALL";
}

function parsePoolSort(value: string | null): PoolSort {
  return SORTS.find((item) => item.value === value)?.value ?? "UPDATED";
}

function poolViewToQueryValue(view: PoolView): "mine" | "public" | "all" | undefined {
  switch (view) {
    case "MINE":
      return "mine";
    case "PUBLIC":
      return "public";
    case "ALL":
      return "all";
    case "DEFAULT":
      return undefined;
  }
}

function getPoolViewCopy(view: PoolView): { title: string; description: string } {
  if (view === "PUBLIC") {
    return {
      title: "公开番组",
      description: "挑一组喜欢的动画，开始对决，生成个人 Tier List。你的结果也会匿名聚合到社区榜单。"
    };
  }

  if (view === "ALL") {
    return {
      title: "全部可见番组",
      description: "查看你创建的番组和公开番组，快速继续个人对决或进入作品墙。"
    };
  }

  return {
    title: "我的番组",
    description: "继续上次的对决，或挑一组动画开始。已归档番组可在筛选中找回。"
  };
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

function sampleLabelText(label: "empty" | "low" | "trend" | "stable"): string {
  switch (label) {
    case "empty":
      return "";
    case "low":
      return " · 样本还少";
    case "trend":
      return " · 已有初步趋势";
    case "stable":
      return " · 榜单逐渐稳定";
  }
}

function communitySummaryTitle(label: "empty" | "low" | "trend" | "stable"): string {
  switch (label) {
    case "empty":
      return "暂无社区结果";
    case "low":
      return "当前参考";
    case "trend":
      return "初步趋势";
    case "stable":
      return "社区第一";
  }
}
