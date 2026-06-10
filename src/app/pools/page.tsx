"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
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
    if (
      !window.confirm("这会从列表中隐藏该番组，但不会删除对决历史。是否继续？")
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

  const hasSearch = query.trim().length > 0;

  return (
    <PageShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">我的番组</h1>
          <p className="mt-2 text-sm text-zinc-400">当前使用开发期临时用户。</p>
        </div>
        <Link
          href="/pools/new"
          className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-200"
        >
          新建番组
        </Link>
      </div>

      <form onSubmit={handleSearch} className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索番组名称或描述"
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as PoolFilter)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
        >
          <option value="ALL">全部</option>
          <option value="ACTIVE">进行中</option>
          <option value="ARCHIVED">已归档</option>
        </select>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
        >
          搜索
        </button>
      </form>

      {isLoading ? <StateText text="正在加载番组..." /> : null}
      {error ? <StateText text={error} tone="error" /> : null}
      {notice ? <StateText text={notice} tone="notice" /> : null}
      {!isLoading && !error && pools.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-white/15 p-10 text-center">
          <p className="text-zinc-300">
            {hasSearch ? "没有匹配的番组，请调整关键词。" : "还没有番组，创建第一个番组开始排序。"}
          </p>
          {!hasSearch ? (
            <Link href="/pools/new" className="mt-4 inline-block text-sm font-semibold text-cyan-300">
              去创建
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pools.map((pool) => {
          const isArchived = pool.status === "ARCHIVED" || pool.deletedAt !== null;
          const isEditing = editingPoolId === pool.id;

          return (
            <article
              key={pool.id}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="min-h-20 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={editVisibility}
                      onChange={(event) =>
                        setEditVisibility(event.target.value as "PRIVATE" | "UNLISTED" | "PUBLIC")
                      }
                      className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    >
                      <option value="PRIVATE">PRIVATE</option>
                      <option value="UNLISTED">UNLISTED</option>
                      <option value="PUBLIC">PUBLIC</option>
                    </select>
                    <input
                      value={editTags}
                      onChange={(event) => setEditTags(event.target.value)}
                      placeholder="标签，逗号分隔"
                      className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(pool.id)}
                      disabled={isMutating}
                      className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingPoolId(null)}
                      disabled={isMutating}
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/pools/${pool.id}`}
                      className="text-lg font-semibold text-white hover:text-cyan-200"
                    >
                      {pool.name}
                    </Link>
                    <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400">
                      {isArchived ? "ARCHIVED" : pool.visibility}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-400">
                    {pool.description ?? "暂无描述"}
                  </p>
                  <p className="mt-5 text-xs text-zinc-500">
                    更新于 {new Date(pool.updatedAt).toLocaleString()}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => beginEdit(pool)}
                      disabled={isArchived || isMutating}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleArchive(pool)}
                      disabled={isArchived || isMutating}
                      className="rounded-lg border border-red-300/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      归档/删除
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </PageShell>
  );
}

function StateText({
  text,
  tone = "muted",
}: {
  text: string;
  tone?: "muted" | "error" | "notice";
}) {
  const color =
    tone === "error" ? "text-red-300" : tone === "notice" ? "text-cyan-200" : "text-zinc-400";

  return <p className={`mt-8 text-sm ${color}`}>{text}</p>;
}
