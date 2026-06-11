"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  archivePool,
  listPools,
  updatePool,
  type PoolSummary
} from "@/lib/client-api";

type PoolFilter = "ALL" | "ACTIVE" | "ARCHIVED";

export default function PoolsPage() {
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PoolFilter>("ACTIVE");
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">(
    "PRIVATE"
  );
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
        q: query.trim() || undefined,
        status: filter === "ALL" ? undefined : filter,
        includeArchived: filter === "ALL",
      });
      setPools(data.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载番组失败");
    } finally {
      setIsLoading(false);
    }
  }, [filter, query]);

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
          .filter(Boolean),
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
    if (!window.confirm("这会从列表中隐藏该番组，但不会删除对决历史。是否继续？")) {
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

  const hasSearch = query.trim().length > 0;
  const activeCount = pools.filter((pool) => pool.status !== "ARCHIVED" && pool.deletedAt === null).length;

  return (
    <PageShell>
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <AppBadge tone="source">Dashboard</AppBadge>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            我的番组
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            管理你的动画池，创建对决、编辑信息，或者把测试番组归档到历史列表。
          </p>
        </div>
        <AppCard className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="当前显示" value={String(pools.length)} />
            <Stat label="进行中" value={String(activeCount)} />
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
        <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索番组名称或描述"
            className="anime-field"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as PoolFilter)}
            className="anime-field"
          >
            <option value="ALL">全部</option>
            <option value="ACTIVE">进行中</option>
            <option value="ARCHIVED">已归档</option>
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
            title={hasSearch ? "没有匹配的番组" : "还没有番组"}
            description={hasSearch ? "调整关键词或切换状态过滤后再试。" : "创建第一个番组，添加动画后就可以开始两两对决。"}
            action={
              !hasSearch ? (
                <Link href="/pools/new" className={appButtonClasses({ variant: "primary" })}>
                  创建番组
                </Link>
              ) : null
            }
          />
        </div>
      ) : null}

      <section className="mt-8">
        <SectionHeader
          eyebrow="Pools"
          title="番组列表"
          description="归档番组会弱化显示，历史数据仍保留。"
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pools.map((pool) => {
            const isArchived = pool.status === "ARCHIVED" || pool.deletedAt !== null;
            const isEditing = editingPoolId === pool.id;

            return (
              <AppCard
                key={pool.id}
                className={`p-5 transition hover:border-cyan-300/25 ${
                  isArchived ? "opacity-60 grayscale-[0.25]" : ""
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="anime-field"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      className="anime-field min-h-24"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        value={editVisibility}
                        onChange={(event) =>
                          setEditVisibility(event.target.value as "PRIVATE" | "UNLISTED" | "PUBLIC")
                        }
                        className="anime-field"
                      >
                        <option value="PRIVATE">PRIVATE</option>
                        <option value="UNLISTED">UNLISTED</option>
                        <option value="PUBLIC">PUBLIC</option>
                      </select>
                      <input
                        value={editTags}
                        onChange={(event) => setEditTags(event.target.value)}
                        placeholder="标签，逗号分隔"
                        className="anime-field"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AppButton onClick={() => handleSave(pool.id)} disabled={isMutating} variant="primary">
                        保存
                      </AppButton>
                      <AppButton onClick={() => setEditingPoolId(null)} disabled={isMutating} variant="ghost">
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
                      <AppBadge tone={isArchived ? "danger" : "status"}>
                        {isArchived ? "ARCHIVED" : pool.visibility}
                      </AppBadge>
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
                      {pool.description ?? "暂无描述"}
                    </p>
                    {pool.tags.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {pool.tags.slice(0, 4).map((tag) => (
                          <AppBadge key={tag} tone="muted">
                            {tag}
                          </AppBadge>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-5 text-xs text-slate-500">
                      更新于 {new Date(pool.updatedAt).toLocaleString()}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <AppButton
                        onClick={() => beginEdit(pool)}
                        disabled={isArchived || isMutating}
                        variant="ghost"
                        size="sm"
                      >
                        编辑
                      </AppButton>
                      <AppButton
                        onClick={() => handleArchive(pool)}
                        disabled={isArchived || isMutating}
                        variant="danger"
                        size="sm"
                      >
                        归档/删除
                      </AppButton>
                    </div>
                  </>
                )}
              </AppCard>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
