"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PoolFilter>("ALL");
  const [sort, setSort] = useState<PoolSort>("UPDATED");
  const [view, setView] = useState<PoolView>(() => parsePoolView(searchParams.get("view")));
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

  useEffect(() => {
    setView(parsePoolView(searchParams.get("view")));
  }, [searchParams]);

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

  function handleViewChange(nextView: PoolView) {
    setView(nextView);
    const nextParams = new URLSearchParams(searchParams.toString());
    const queryView = poolViewToQueryValue(nextView);

    if (queryView === undefined) {
      nextParams.delete("view");
    } else {
      nextParams.set("view", queryView);
    }

    const nextQuery = nextParams.toString();
    router.replace(`/pools${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
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
  const readyCount = pools.filter((pool) => pool.uiStatus === "READY").length;
  const isPublicView = view === "PUBLIC";
  const viewCopy = getPoolViewCopy(view);

  return (
    <PageShell>
      <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <AppBadge tone={isPublicView ? "status" : "source"}>
            {isPublicView ? "Public Pools" : "Pool Control"}
          </AppBadge>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            {viewCopy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {viewCopy.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-xs text-slate-400">
          <span className="font-black text-white">{String(pools.length)}</span> 个番组
          <span className="text-slate-500">·</span>
          <span className="font-black text-emerald-200">{String(readyCount)}</span> 可开始
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">筛选 {FILTERS.find((item) => item.value === filter)?.label ?? "全部"}</span>
        </div>
      </section>

      <div className="mt-7 rounded-2xl border border-white/10 bg-slate-950/22 p-3">
        <form onSubmit={handleSearch} className="grid gap-2 lg:grid-cols-[1fr_140px_140px_140px_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索番组名称或描述"
            className="anime-field"
          />
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
      </div>

      <div className="mt-5 space-y-3">
        {error ? <ErrorAlert message={error} /> : null}
        {notice ? <ErrorAlert message={notice} tone="notice" /> : null}
        {isLoading ? <ErrorAlert message="正在加载番组..." tone="notice" /> : null}
      </div>

      {!isLoading && !error && pools.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={
              hasSearch
                ? "没有匹配的番组"
                : isPublicView
                  ? "暂无公开番组"
                  : "当前筛选没有番组"
            }
            description={
              hasSearch
                ? "调整关键词、状态或排序后再试。"
                : isPublicView
                  ? "公开番组开放后会出现在这里；你可以稍后再来，或切回我的番组。"
                  : filter === "ARCHIVED"
                    ? "还没有归档番组。"
                    : "创建第一个番组，添加动画后就可以开始两两对决。"
            }
            action={
              !hasSearch && isPublicView ? (
                <button
                  type="button"
                  onClick={() => handleViewChange("MINE")}
                  className={appButtonClasses({ variant: "secondary" })}
                >
                  查看我的番组
                </button>
              ) : !hasSearch && filter !== "ARCHIVED" ? (
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
          title={isPublicView ? "公开番组列表" : "番组列表"}
          description={isPublicView ? "所有人都可以浏览公开番组；登录后加入大乱斗会进入你自己的个人对决。" : "默认隐藏已归档番组；切到已归档可以恢复或查看历史。"}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          {officialDemoLabel ? (
            <div className="flex flex-wrap gap-2">
              <AppBadge tone="source">{officialDemoLabel}</AppBadge>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AppBadge tone={visibilityTone(pool.visibility)}>
                {formatPoolVisibility(pool.visibility)}
              </AppBadge>
              {isPublicView && pool.visibility === "PUBLIC" && !isArchived ? (
                <AppBadge tone="status">可参与社区大乱斗</AppBadge>
              ) : null}
            </div>
          )}
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
            {pool.description ?? "暂无描述"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <AppBadge tone={toneForStatus(uiStatus)}>{statusLabel}</AppBadge>
            {animeCount > 0 ? (
              <AppBadge tone="muted">{animeCount} 部动画</AppBadge>
            ) : null}
            {comparisonCount > 0 ? (
              <AppBadge tone="muted">{comparisonCount} 次对决</AppBadge>
            ) : null}
            {isArchived ? <AppBadge tone="danger">已归档</AppBadge> : null}
          </div>
          {pool.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {pool.tags.slice(0, 4).map((tag) => (
                <AppBadge key={tag} tone="muted">
                  {labelAnimeTag(tag)}
                </AppBadge>
              ))}
            </div>
          ) : null}

          {isPublicView && pool.visibility === "PUBLIC" && pool.communitySummary ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
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
                        <p className="text-xs text-slate-400">社区第一</p>
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

          <p className="mt-3 text-xs text-slate-500">
            更新于 {formatDateTimeStable(pool.updatedAt)}
            {confidenceScore > 0 ? ` · 信心 ${confidenceScore.toFixed(1)}` : ""}
          </p>
          <div className="mt-auto pt-4">
            {canMatch || canPromptLoginToMatch ? (
              <AppButton
                onClick={() =>
                  canPromptLoginToMatch
                    ? window.location.assign(`/login?next=${encodeURIComponent(`/pools/${pool.id}`)}`)
                    : onOpenRun(pool, "match")
                }
                disabled={isMutating}
                variant="primary"
                size="sm"
                className="w-full"
              >
                {isPublicView && pool.visibility === "PUBLIC"
                  ? canPromptLoginToMatch
                    ? "登录后加入大乱斗"
                    : "加入大乱斗"
                  : uiStatus === "READY"
                    ? "开始对决"
                    : "继续对决"}
              </AppButton>
            ) : (
              <Link
                href={`/pools/${pool.id}`}
                className={appButtonClasses({ variant: "primary", size: "sm", className: "w-full" })}
              >
                进入作品墙
              </Link>
            )}
          </div>
          <details className="mt-3 rounded-xl border border-white/10 bg-slate-950/24 px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-semibold text-slate-300">
              更多操作
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/pools/${pool.id}`} className={appButtonClasses({ variant: "secondary", size: "sm" })}>
                进入
              </Link>
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
      description: "加入公开番组的社区大乱斗，生成你的个人 Tier List，并以匿名聚合方式贡献到社区榜单。"
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
    description: "快速找到、继续或清理测试番组。归档只会隐藏默认列表，不会删除历史对决和 Tier List。"
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


