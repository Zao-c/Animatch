"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimeCard } from "@/components/AnimeCard";
import { AnimeCover } from "@/components/AnimeCover";
import { PageShell } from "@/components/PageShell";
import {
  addAnimeToPool,
  bulkImportAnimeToPool,
  createManualAnime,
  discoverAnime,
  getOrCreateDefaultRun,
  getPool,
  removeAnimeFromPool,
  searchAnime,
  type PoolDetail,
  type PublicAnime,
} from "@/lib/client-api";

type AddTab = "search" | "browse" | "manual" | "bangumi";

const TABS: { key: AddTab; label: string }[] = [
  { key: "search", label: "本地搜索" },
  { key: "browse", label: "分类浏览" },
  { key: "manual", label: "手动添加" },
  { key: "bangumi", label: "Bangumi 导入（可选）" },
];

export default function PoolDetailPage({ params }: { params: { poolId: string } }) {
  const router = useRouter();
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AddTab>("search");

  // Search tab state
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<PublicAnime[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Browse tab state
  const [browseTag, setBrowseTag] = useState("");
  const [browseYearFrom, setBrowseYearFrom] = useState("");
  const [browseYearTo, setBrowseYearTo] = useState("");
  const [browseType, setBrowseType] = useState("");
  const [browseSort, setBrowseSort] = useState("title");
  const [browseResults, setBrowseResults] = useState<PublicAnime[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [isBrowsing, setIsBrowsing] = useState(false);

  // Manual tab state
  const [manualTitle, setManualTitle] = useState("");
  const [manualTitleCn, setManualTitleCn] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualType, setManualType] = useState("");
  const [manualTags, setManualTags] = useState("");

  // Bangumi tab state
  const [bulkInput, setBulkInput] = useState("");

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

  function clearError() { setError(null); setNotice(null); }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchKeyword.trim()) return;
    clearError();
    setIsSearching(true);
    try {
      const data = await searchAnime(searchKeyword, 12);
      setSearchResults(data.items);
      setSearchMessage(data.message ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "搜索失败");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleBrowse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    setIsBrowsing(true);
    try {
      const data = await discoverAnime({
        tag: browseTag || undefined,
        yearFrom: browseYearFrom ? Number(browseYearFrom) : undefined,
        yearTo: browseYearTo ? Number(browseYearTo) : undefined,
        type: browseType || undefined,
        sort: browseSort,
        limit: 12,
        offset: 0,
      });
      setBrowseResults(data.items);
      setBrowseTotal(data.total);
      setBrowseOffset(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "浏览失败");
    } finally {
      setIsBrowsing(false);
    }
  }

  async function handleBrowseMore() {
    const nextOffset = browseOffset + 12;
    clearError();
    setIsBrowsing(true);
    try {
      const data = await discoverAnime({
        tag: browseTag || undefined,
        yearFrom: browseYearFrom ? Number(browseYearFrom) : undefined,
        yearTo: browseYearTo ? Number(browseYearTo) : undefined,
        type: browseType || undefined,
        sort: browseSort,
        limit: 12,
        offset: nextOffset,
      });
      setBrowseResults((prev) => [...prev, ...data.items]);
      setBrowseOffset(nextOffset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载更多失败");
    } finally {
      setIsBrowsing(false);
    }
  }

  async function handleManualAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualTitle.trim()) return;
    clearError();
    setIsMutating(true);
    try {
      const tagsArr = manualTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const anime = await createManualAnime({
        title: manualTitle,
        titleCn: manualTitleCn || undefined,
        imageUrl: manualImageUrl || undefined,
        thumbnailUrl: manualImageUrl || undefined,
        year: manualYear ? Number(manualYear) : undefined,
        animeType: manualType || undefined,
        tags: tagsArr.length > 0 ? tagsArr : undefined,
      });
      await addAnimeToPool(params.poolId, { animeId: anime.id });
      await refreshPool();
      setNotice(`已手动创建并添加：${anime.titleCn ?? anime.title}`);
      setManualTitle(""); setManualTitleCn(""); setManualImageUrl("");
      setManualYear(""); setManualType(""); setManualTags("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "手动添加失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAdd(anime: PublicAnime) {
    clearError();
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
    if (!bulkInput.trim()) return;
    clearError();
    setIsMutating(true);
    try {
      const result = await bulkImportAnimeToPool(params.poolId, bulkInput);
      await refreshPool();
      setNotice(
        `新增 ${result.added.length} 部，跳过 ${result.skipped.length} 部，失败 ${result.failed.length} 部`
      );
      if (result.failed.length === 0) setBulkInput("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量导入失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemove(animeId: string) {
    clearError();
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
    clearError();
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
    return <PageShell><p className="text-sm text-zinc-400">正在加载番组详情...</p></PageShell>;
  }

  if (pool === null) {
    return <PageShell><p className="text-sm text-red-300">{error ?? "番组不存在"}</p></PageShell>;
  }

  const canStart = pool.anime.length >= 2;
  const joinedAnimeIds = new Set(pool.anime.map((entry) => entry.animeId));

  return (
    <PageShell>
      {/* Header */}
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
          >开始对决</button>
          <button
            onClick={() => enterRun("tier")}
            disabled={isMutating}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >查看 Tier List</button>
        </div>
      </div>

      {!canStart && (
        <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          至少添加 2 部动画后才能开始对决。
        </p>
      )}
      {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
      {notice && <p className="mt-5 text-sm text-cyan-200">{notice}</p>}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left: Anime list */}
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">作品列表</h2>
          {pool.anime.length === 0 ? (
            <p className="mt-5 text-sm text-zinc-400">还没有添加动画。</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pool.anime.map((entry) => (
                <div key={entry.id} className="flex gap-3 rounded-lg border border-white/10 bg-zinc-950/50 p-3">
                  <AnimeCover
                    src={entry.anime.thumbnailUrl ?? entry.anime.imageSmallUrl ?? entry.anime.imageMediumUrl ?? entry.anime.imageUrl}
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
                    >移除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Add anime panel with Tabs */}
        <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">添加动画</h2>

          {/* Tabs */}
          <div className="mt-4 flex flex-wrap gap-1 border-b border-white/10 pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-t px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === tab.key
                    ? "border-b-2 border-cyan-400 text-cyan-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >{tab.label}</button>
            ))}
          </div>

          {/* Tab: Local Search */}
          {activeTab === "search" && (
            <div className="mt-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="输入动画名搜索本地库"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                >搜索</button>
              </form>
              {searchMessage && (
                <p className="mt-3 text-sm text-zinc-400">{searchMessage}</p>
              )}
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
          )}

          {/* Tab: Browse */}
          {activeTab === "browse" && (
            <div className="mt-4">
              <form onSubmit={handleBrowse} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={browseTag}
                    onChange={(e) => setBrowseTag(e.target.value)}
                    placeholder="标签 e.g. mystery"
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    value={browseYearFrom}
                    onChange={(e) => setBrowseYearFrom(e.target.value)}
                    placeholder="年份起"
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  />
                  <input
                    value={browseYearTo}
                    onChange={(e) => setBrowseYearTo(e.target.value)}
                    placeholder="年份止"
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    value={browseType}
                    onChange={(e) => setBrowseType(e.target.value)}
                    placeholder="类型 e.g. TV"
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  />
                  <select
                    value={browseSort}
                    onChange={(e) => setBrowseSort(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  >
                    <option value="title">按标题</option>
                    <option value="year">按年份</option>
                    <option value="score">按评分</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isBrowsing}
                  className="w-full rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                >浏览</button>
              </form>
              {browseTotal > 0 && (
                <p className="mt-3 text-xs text-zinc-500">共 {browseTotal} 部</p>
              )}
              <div className="mt-4 space-y-3">
                {browseResults.map((anime) => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    disabled={isMutating || joinedAnimeIds.has(anime.id)}
                    actionLabel={joinedAnimeIds.has(anime.id) ? "已加入" : "加入番组"}
                    onClick={() => handleAdd(anime)}
                  />
                ))}
              </div>
              {browseResults.length < browseTotal && (
                <button
                  onClick={handleBrowseMore}
                  disabled={isBrowsing}
                  className="mt-3 w-full rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >加载更多</button>
              )}
            </div>
          )}

          {/* Tab: Manual Add */}
          {activeTab === "manual" && (
            <div className="mt-4">
              <form onSubmit={handleManualAdd} className="space-y-3">
                <input
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="动画名称 *"
                  required
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                />
                <input
                  value={manualTitleCn}
                  onChange={(e) => setManualTitleCn(e.target.value)}
                  placeholder="中文名（可选）"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                />
                <input
                  value={manualImageUrl}
                  onChange={(e) => setManualImageUrl(e.target.value)}
                  placeholder="封面图 URL（可选）"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                />
                <div className="flex gap-2">
                  <input
                    value={manualYear}
                    onChange={(e) => setManualYear(e.target.value)}
                    placeholder="年份"
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  />
                  <input
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value)}
                    placeholder="类型 e.g. TV"
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                  />
                </div>
                <input
                  value={manualTags}
                  onChange={(e) => setManualTags(e.target.value)}
                  placeholder="标签，逗号分隔（可选）"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                />
                <button
                  type="submit"
                  disabled={isMutating}
                  className="w-full rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                >创建并加入</button>
              </form>
            </div>
          )}

          {/* Tab: Bangumi Import */}
          {activeTab === "bangumi" && (
            <div className="mt-4">
              <p className="text-xs text-zinc-500 mb-3">
                输入 Bangumi ID 导入（可选，可能受网络影响）。
                外部数据源暂时不可用时，可使用本地搜索、分类浏览或手动添加。
              </p>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="876, 877&#10;https://bgm.tv/subject/878"
                className="min-h-32 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
              />
              <button
                onClick={handleBulkImport}
                disabled={isMutating}
                className="mt-3 w-full rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >导入到番组</button>
            </div>
          )}
        </aside>
      </section>

      {/* License footer */}
      <p className="mt-10 text-center text-xs text-zinc-600">
        Anime metadata powered by{" "}
        <a href="https://github.com/manami-project/anime-offline-database" target="_blank" className="underline hover:text-zinc-400">
          anime-offline-database
        </a>
        . License: ODbL-1.0 + DbCL-1.0.
      </p>
    </PageShell>
  );
}
