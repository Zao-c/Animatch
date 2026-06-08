"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimeCard } from "@/components/AnimeCard";
import { AnimeCover } from "@/components/AnimeCover";
import { PageShell } from "@/components/PageShell";
import {
  addAnimeToPool,
  bulkImportAnimeToPool,
  getOrCreateDefaultRun,
  getPool,
  removeAnimeFromPool,
  searchAnime,
  type PoolDetail,
  type PublicAnime
} from "@/lib/client-api";

export default function PoolDetailPage({ params }: { params: { poolId: string } }) {
  const router = useRouter();
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<PublicAnime[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshPool = useCallback(async () => {
    const data = await getPool(params.poolId);
    setPool(data);
  }, [params.poolId]);

  useEffect(() => {
    refreshPool()
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "加载番组详情失败")
      )
      .finally(() => setIsLoading(false));
  }, [refreshPool]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchKeyword.trim()) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSearching(true);

    try {
      const data = await searchAnime(searchKeyword, 12);
      setSearchResults(data.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "搜索失败");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAdd(anime: PublicAnime) {
    setError(null);
    setNotice(null);
    setIsMutating(true);

    try {
      await addAnimeToPool(params.poolId, { animeId: anime.id });
      await refreshPool();
      setNotice(`已加入：${anime.titleCn ?? anime.title}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加入番组失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleBulkImport() {
    if (!bulkInput.trim()) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsMutating(true);

    try {
      const result = await bulkImportAnimeToPool(params.poolId, bulkInput);
      await refreshPool();
      setNotice(
        `新增 ${result.added.length} 部，跳过 ${result.skipped.length} 部，失败 ${result.failed.length} 部`
      );
      if (result.failed.length === 0) {
        setBulkInput("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量导入失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemove(animeId: string) {
    setError(null);
    setNotice(null);
    setIsMutating(true);

    try {
      await removeAnimeFromPool(params.poolId, animeId);
      await refreshPool();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "移除失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function enterRun(target: "match" | "tier") {
    setError(null);
    setIsMutating(true);

    try {
      const result = await getOrCreateDefaultRun(params.poolId);
      router.push(`/pools/${params.poolId}/runs/${result.run.id}/${target}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建默认榜单失败");
      setIsMutating(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <p className="text-sm text-zinc-400">正在加载番组详情...</p>
      </PageShell>
    );
  }

  if (pool === null) {
    return (
      <PageShell>
        <p className="text-sm text-red-300">{error ?? "番组不存在"}</p>
      </PageShell>
    );
  }

  const canStart = pool.anime.length >= 2;
  const joinedAnimeIds = new Set(pool.anime.map((entry) => entry.animeId));

  return (
    <PageShell>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">{pool.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            {pool.description ?? "暂无描述"}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            {pool.visibility} / {pool.anime.length} 部动画
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => enterRun("match")}
            disabled={!canStart || isMutating}
            className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            开始对决
          </button>
          <button
            onClick={() => enterRun("tier")}
            disabled={isMutating}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            查看 Tier List
          </button>
        </div>
      </div>

      {!canStart ? (
        <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          至少添加 2 部动画后才能开始对决。
        </p>
      ) : null}
      {error ? <p className="mt-5 text-sm text-red-300">{error}</p> : null}
      {notice ? <p className="mt-5 text-sm text-cyan-200">{notice}</p> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">作品列表</h2>
          {pool.anime.length === 0 ? (
            <p className="mt-5 text-sm text-zinc-400">还没有添加动画。</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pool.anime.map((entry) => (
                <div
                  key={entry.id}
                  className="flex gap-3 rounded-lg border border-white/10 bg-zinc-950/50 p-3"
                >
                  <AnimeCover
                    src={
                      entry.anime.imageSmallUrl ??
                      entry.anime.imageMediumUrl ??
                      entry.anime.imageUrl
                    }
                    title={entry.anime.titleCn ?? entry.anime.title}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-sm font-semibold text-white">
                      {entry.anime.titleCn ?? entry.anime.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">#{entry.position}</p>
                    <button
                      onClick={() => handleRemove(entry.animeId)}
                      disabled={isMutating}
                      className="mt-3 text-xs font-medium text-red-300 disabled:opacity-50"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">搜索添加</h2>
            <form onSubmit={handleSearch} className="mt-4 flex gap-2">
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="输入动画名"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
              />
              <button
                disabled={isSearching}
                className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                搜索
              </button>
            </form>
            <div className="mt-4 space-y-3">
              {searchResults.map((anime) => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  disabled={isMutating || joinedAnimeIds.has(anime.id)}
                  actionLabel={joinedAnimeIds.has(anime.id) ? "已加入" : "加入番组"}
                  onClick={() => handleAdd(anime)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">批量导入</h2>
            <textarea
              value={bulkInput}
              onChange={(event) => setBulkInput(event.target.value)}
              placeholder="876, 877&#10;https://bgm.tv/subject/878"
              className="mt-4 min-h-32 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
            />
            <button
              onClick={handleBulkImport}
              disabled={isMutating}
              className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              导入到番组
            </button>
          </div>
        </aside>
      </section>
    </PageShell>
  );
}
