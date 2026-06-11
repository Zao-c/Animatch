"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimeCard } from "@/components/AnimeCard";
import { AnimeCover } from "@/components/AnimeCover";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  addAnimeToPool,
  archivePool,
  bulkImportAnimeToPool,
  clearPoolAnimeDisplayOverrides,
  createManualAnime,
  discoverAnime,
  getOrCreateDefaultRun,
  getPool,
  listRuns,
  removeAnimeFromPool,
  searchAnime,
  updatePoolAnimeDisplay,
  updatePool,
  type PersonalRun,
  type PoolAnimeEntry,
  type PoolDetail,
  type PublicAnime,
} from "@/lib/client-api";

type AddTab = "search" | "browse" | "manual" | "bangumi";
type DisplayOverrideForm = {
  displayTitleOverride: string;
  coverUrlOverride: string;
  animeTypeOverride: string;
  tagsOverride: string;
  overrideNote: string;
};

const ANIME_TYPE_OPTIONS = ["", "TV", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC", "CM", "PV", "UNKNOWN"];
const TABS: { key: AddTab; label: string }[] = [
  { key: "search", label: "本地搜索" },
  { key: "browse", label: "分类浏览" },
  { key: "manual", label: "手动添加" },
  { key: "bangumi", label: "外部导入" },
];

export default function PoolDetailPage({ params }: { params: { poolId: string } }) {
  const router = useRouter();
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [runs, setRuns] = useState<PersonalRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AddTab>("search");

  const [isEditingPool, setIsEditingPool] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">(
    "PRIVATE"
  );
  const [editTags, setEditTags] = useState("");
  const [editingDisplayAnimeId, setEditingDisplayAnimeId] = useState<string | null>(null);
  const [displayForm, setDisplayForm] = useState<DisplayOverrideForm>({
    displayTitleOverride: "",
    coverUrlOverride: "",
    animeTypeOverride: "",
    tagsOverride: "",
    overrideNote: "",
  });

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<PublicAnime[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [browseTag, setBrowseTag] = useState("");
  const [browseYearFrom, setBrowseYearFrom] = useState("");
  const [browseYearTo, setBrowseYearTo] = useState("");
  const [browseType, setBrowseType] = useState("");
  const [browseSort, setBrowseSort] = useState("title");
  const [browseResults, setBrowseResults] = useState<PublicAnime[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [isBrowsing, setIsBrowsing] = useState(false);

  const [manualTitle, setManualTitle] = useState("");
  const [manualTitleCn, setManualTitleCn] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualType, setManualType] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [bulkInput, setBulkInput] = useState("");

  const refreshRuns = useCallback(async () => {
    const data = await listRuns(params.poolId);
    setRuns(data.items);
  }, [params.poolId]);

  const refreshPool = useCallback(async () => {
    const data = await getPool(params.poolId);
    setPool(data);
    setEditName(data.name);
    setEditDescription(data.description ?? "");
    setEditVisibility(data.visibility);
    setEditTags(data.tags.join(", "));
  }, [params.poolId]);

  useEffect(() => {
    refreshPool()
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "加载番组详情失败")
      )
      .finally(() => setIsLoading(false));
  }, [refreshPool]);

  useEffect(() => {
    if (pool === null) return;
    void refreshRuns().catch(() => setRuns([]));
  }, [pool, refreshRuns]);

  function clearMessage() {
    setError(null);
    setNotice(null);
  }

  function archived() {
    return pool === null || pool.status === "ARCHIVED" || pool.deletedAt !== null;
  }

  async function handleSavePool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pool === null || archived()) return;
    if (!editName.trim()) {
      setError("番组名称不能为空");
      return;
    }

    clearMessage();
    setIsMutating(true);

    try {
      const updated = await updatePool(pool.id, {
        name: editName,
        description: editDescription,
        visibility: editVisibility,
        tags: editTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setPool((current) => (current === null ? current : { ...current, ...updated }));
      setIsEditingPool(false);
      setNotice("番组信息已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleArchivePool() {
    if (pool === null || archived()) return;
    if (!window.confirm("这会从列表中隐藏该番组，但不会删除对决历史。是否继续？")) {
      return;
    }

    clearMessage();
    setIsMutating(true);

    try {
      await archivePool(pool.id);
      router.push("/pools");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "归档失败");
      setIsMutating(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (archived() || !searchKeyword.trim()) return;
    clearMessage();
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
    if (archived()) return;
    clearMessage();
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
    if (archived()) return;
    const nextOffset = browseOffset + 12;
    clearMessage();
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
      setBrowseResults((current) => [...current, ...data.items]);
      setBrowseOffset(nextOffset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载更多失败");
    } finally {
      setIsBrowsing(false);
    }
  }

  async function handleManualAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (archived() || !manualTitle.trim()) return;
    clearMessage();
    setIsMutating(true);

    try {
      const tags = manualTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const anime = await createManualAnime({
        title: manualTitle,
        titleCn: manualTitleCn || undefined,
        imageUrl: manualImageUrl || undefined,
        thumbnailUrl: manualImageUrl || undefined,
        year: manualYear ? Number(manualYear) : undefined,
        animeType: manualType || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      await addAnimeToPool(params.poolId, { animeId: anime.id });
      await refreshPool();
      setNotice(`已手动创建并添加：${anime.titleCn ?? anime.title}`);
      setManualTitle("");
      setManualTitleCn("");
      setManualImageUrl("");
      setManualYear("");
      setManualType("");
      setManualTags("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "手动添加失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAdd(anime: PublicAnime) {
    if (archived()) return;
    clearMessage();
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
    if (archived() || !bulkInput.trim()) return;
    clearMessage();
    setIsMutating(true);

    try {
      const result = await bulkImportAnimeToPool(params.poolId, bulkInput);
      await refreshPool();
      setNotice(`新增 ${result.added.length} 部，跳过 ${result.skipped.length} 部，失败 ${result.failed.length} 部`);
      if (result.failed.length === 0) setBulkInput("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量导入失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemove(animeId: string) {
    if (archived()) return;
    clearMessage();
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

  function startEditingDisplay(entry: PoolAnimeEntry) {
    clearMessage();
    setEditingDisplayAnimeId(entry.animeId);
    setDisplayForm({
      displayTitleOverride: entry.displayTitleOverride ?? "",
      coverUrlOverride: entry.coverUrlOverride ?? "",
      animeTypeOverride: entry.animeTypeOverride ?? "",
      tagsOverride: entry.tagsOverride.join(", "),
      overrideNote: entry.overrideNote ?? "",
    });
  }

  async function handleSaveDisplay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pool === null || archived() || editingDisplayAnimeId === null) return;

    clearMessage();
    setIsMutating(true);

    try {
      await updatePoolAnimeDisplay(pool.id, editingDisplayAnimeId, {
        displayTitleOverride: displayForm.displayTitleOverride,
        coverUrlOverride: displayForm.coverUrlOverride,
        animeTypeOverride: displayForm.animeTypeOverride,
        tagsOverride: displayForm.tagsOverride
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        overrideNote: displayForm.overrideNote,
      });
      await refreshPool();
      setEditingDisplayAnimeId(null);
      setNotice("动画显示信息已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存显示修正失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleClearDisplay(animeId: string) {
    if (pool === null || archived()) return;

    clearMessage();
    setIsMutating(true);

    try {
      await clearPoolAnimeDisplayOverrides(pool.id, animeId);
      await refreshPool();
      setEditingDisplayAnimeId(null);
      setNotice("显示修正已清除");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "清除显示修正失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function enterRun(target: "match" | "tier") {
    if (archived()) return;
    clearMessage();
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
        <ErrorAlert message="正在加载番组详情..." tone="notice" />
      </PageShell>
    );
  }

  if (pool === null) {
    return (
      <PageShell>
        <ErrorAlert message={error ?? "番组不存在"} />
      </PageShell>
    );
  }

  const isArchived = archived();
  const latestRun = runs[0];
  const canStart = pool.anime.length >= 2 && !isArchived;
  const joinedAnimeIds = new Set(pool.anime.map((entry) => entry.animeId));

  return (
    <PageShell>
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone={isArchived ? "danger" : "status"}>
              {isArchived ? "已归档" : pool.visibility}
            </AppBadge>
            <AppBadge tone="source">{pool.anime.length} 部动画</AppBadge>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            {pool.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            {pool.description ?? "暂无描述"}
          </p>
          {pool.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {pool.tags.map((tag) => (
                <AppBadge key={tag} tone="muted">
                  {tag}
                </AppBadge>
              ))}
            </div>
          ) : null}
        </div>
        <AppCard className="p-5">
          <div className="grid gap-3">
            <AppButton
              onClick={() => enterRun("match")}
              disabled={!canStart || isMutating}
              variant="primary"
              size="lg"
            >
              开始对决
            </AppButton>
            <AppButton
              onClick={() =>
                isArchived && latestRun !== undefined
                  ? router.push(`/pools/${params.poolId}/runs/${latestRun.id}/tier`)
                  : enterRun("tier")
              }
              disabled={isMutating || (isArchived && latestRun === undefined)}
              variant="secondary"
            >
              查看 Tier List
            </AppButton>
            <div className="grid grid-cols-2 gap-2">
              <AppButton
                onClick={() => setIsEditingPool((value) => !value)}
                disabled={isArchived || isMutating}
                variant="ghost"
                size="sm"
              >
                编辑信息
              </AppButton>
              <AppButton
                onClick={handleArchivePool}
                disabled={isArchived || isMutating}
                variant="danger"
                size="sm"
              >
                归档/删除
              </AppButton>
            </div>
          </div>
        </AppCard>
      </section>

      <div className="mt-5 space-y-3">
        {isArchived ? (
          <ErrorAlert message="该番组已归档，只能查看历史结果。" tone="warning" />
        ) : null}
        {!isArchived && !canStart ? (
          <ErrorAlert message="至少添加 2 部动画后才能开始对决。" tone="warning" />
        ) : null}
        {error ? <ErrorAlert message={error} /> : null}
        {notice ? <ErrorAlert message={notice} tone="notice" /> : null}
      </div>

      {isEditingPool && !isArchived ? (
        <AppCard className="mt-6 p-5">
          <form onSubmit={handleSavePool}>
            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <input value={editName} onChange={(event) => setEditName(event.target.value)} className="anime-field" />
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
            </div>
            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              className="anime-field mt-3 min-h-24"
            />
            <input
              value={editTags}
              onChange={(event) => setEditTags(event.target.value)}
              placeholder="标签，逗号分隔"
              className="anime-field mt-3"
            />
            <div className="mt-3 flex gap-2">
              <AppButton type="submit" disabled={isMutating} variant="primary">保存</AppButton>
              <AppButton type="button" onClick={() => setIsEditingPool(false)} disabled={isMutating} variant="ghost">
                取消
              </AppButton>
            </div>
          </form>
        </AppCard>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_410px]">
        <AppCard className="p-5">
          <SectionHeader
            eyebrow="Anime pool"
            title="作品列表"
            description="这些显示修正只作用于当前番组。"
          />
          {pool.anime.length === 0 ? (
            <div className="mt-5">
              <EmptyState title="还没有添加动画" description="从右侧本地搜索、分类浏览或手动添加开始。" />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pool.anime.map((entry) => (
                <PoolAnimeCard
                  key={entry.id}
                  entry={entry}
                  isArchived={isArchived}
                  isMutating={isMutating}
                  isEditing={editingDisplayAnimeId === entry.animeId}
                  displayForm={displayForm}
                  setDisplayForm={setDisplayForm}
                  onEdit={() => startEditingDisplay(entry)}
                  onRemove={() => handleRemove(entry.animeId)}
                  onSave={handleSaveDisplay}
                  onClear={() => handleClearDisplay(entry.animeId)}
                  onCancel={() => setEditingDisplayAnimeId(null)}
                />
              ))}
            </div>
          )}
        </AppCard>

        <AppCard className="p-5">
          <SectionHeader eyebrow="Add anime" title="添加动画" />
          {isArchived ? (
            <p className="mt-4 text-sm text-slate-400">归档番组不能继续添加动画。</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2 border-b border-white/10 pb-3">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === tab.key
                        ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "search" ? (
                <div className="mt-4">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      placeholder="输入动画名搜索本地库"
                      className="anime-field min-w-0 flex-1"
                    />
                    <AppButton type="submit" disabled={isSearching} variant="primary">
                      搜索
                    </AppButton>
                  </form>
                  {searchMessage ? <p className="mt-3 text-sm text-slate-400">{searchMessage}</p> : null}
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
              ) : null}

              {activeTab === "browse" ? (
                <div className="mt-4">
                  <form onSubmit={handleBrowse} className="space-y-3">
                    <input value={browseTag} onChange={(event) => setBrowseTag(event.target.value)} placeholder="标签 e.g. mystery" className="anime-field" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={browseYearFrom} onChange={(event) => setBrowseYearFrom(event.target.value)} placeholder="年份起" className="anime-field" />
                      <input value={browseYearTo} onChange={(event) => setBrowseYearTo(event.target.value)} placeholder="年份止" className="anime-field" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={browseType} onChange={(event) => setBrowseType(event.target.value)} placeholder="类型 e.g. TV" className="anime-field" />
                      <select value={browseSort} onChange={(event) => setBrowseSort(event.target.value)} className="anime-field">
                        <option value="title">按标题</option>
                        <option value="year">按年份</option>
                        <option value="score">按评分</option>
                      </select>
                    </div>
                    <AppButton type="submit" disabled={isBrowsing} variant="primary" className="w-full">
                      浏览
                    </AppButton>
                  </form>
                  {browseTotal > 0 ? <p className="mt-3 text-xs text-slate-500">共 {browseTotal} 部</p> : null}
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
                  {browseResults.length < browseTotal ? (
                    <AppButton onClick={handleBrowseMore} disabled={isBrowsing} variant="ghost" className="mt-3 w-full">
                      加载更多
                    </AppButton>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "manual" ? (
                <form onSubmit={handleManualAdd} className="mt-4 space-y-3">
                  <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="动画名称 *" required className="anime-field" />
                  <input value={manualTitleCn} onChange={(event) => setManualTitleCn(event.target.value)} placeholder="中文名（可选）" className="anime-field" />
                  <input value={manualImageUrl} onChange={(event) => setManualImageUrl(event.target.value)} placeholder="封面图 URL（可选）" className="anime-field" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={manualYear} onChange={(event) => setManualYear(event.target.value)} placeholder="年份" className="anime-field" />
                    <input value={manualType} onChange={(event) => setManualType(event.target.value)} placeholder="类型 e.g. TV" className="anime-field" />
                  </div>
                  <input value={manualTags} onChange={(event) => setManualTags(event.target.value)} placeholder="标签，逗号分隔（可选）" className="anime-field" />
                  <AppButton type="submit" disabled={isMutating} variant="primary" className="w-full">
                    创建并加入
                  </AppButton>
                </form>
              ) : null}

              {activeTab === "bangumi" ? (
                <div className="mt-4">
                  <p className="mb-3 text-xs leading-5 text-slate-500">
                    Bangumi 导入是可选外部来源。不可用时，请使用本地搜索、分类浏览或手动添加。
                  </p>
                  <textarea
                    value={bulkInput}
                    onChange={(event) => setBulkInput(event.target.value)}
                    placeholder={"876, 877\nhttps://bgm.tv/subject/878"}
                    className="anime-field min-h-32"
                  />
                  <AppButton onClick={handleBulkImport} disabled={isMutating} variant="ghost" className="mt-3 w-full">
                    导入到番组
                  </AppButton>
                </div>
              ) : null}
            </>
          )}
        </AppCard>
      </section>

      <p className="mt-10 text-center text-xs text-slate-600">
        Anime metadata powered by{" "}
        <a
          href="https://github.com/manami-project/anime-offline-database"
          target="_blank"
          className="underline hover:text-slate-400"
        >
          anime-offline-database
        </a>
        . License: ODbL-1.0 + DbCL-1.0.
      </p>
    </PageShell>
  );
}

function PoolAnimeCard({
  entry,
  isArchived,
  isMutating,
  isEditing,
  displayForm,
  setDisplayForm,
  onEdit,
  onRemove,
  onSave,
  onClear,
  onCancel
}: {
  entry: PoolAnimeEntry;
  isArchived: boolean;
  isMutating: boolean;
  isEditing: boolean;
  displayForm: DisplayOverrideForm;
  setDisplayForm: React.Dispatch<React.SetStateAction<DisplayOverrideForm>>;
  onEdit: () => void;
  onRemove: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const display = entry.display;
  const title = display.title;
  const coverUrl =
    display.coverUrl ??
    entry.anime.thumbnailUrl ??
    entry.anime.imageSmallUrl ??
    entry.anime.imageMediumUrl ??
    entry.anime.imageUrl;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 transition hover:border-cyan-300/25">
      <div className="flex gap-3">
        <AnimeCover
          src={coverUrl}
          secondarySrc={entry.anime.imageSmallUrl ?? entry.anime.imageUrl}
          title={title}
          size="sm"
          className="shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold text-white">{title}</h3>
            {display.isOverridden ? <AppBadge tone="source">已修正</AppBadge> : null}
          </div>
          {display.subtitle ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{display.subtitle}</p> : null}
          <p className="mt-1 text-xs text-slate-500">
            #{entry.position}
            {display.animeType ? ` / ${display.animeType}` : ""}
          </p>
          {display.tags.length > 0 ? (
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
              {display.tags.slice(0, 4).join(" / ")}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {!isArchived ? (
              <AppButton onClick={onEdit} disabled={isMutating} variant="ghost" size="sm">
                编辑显示
              </AppButton>
            ) : null}
            <AppButton onClick={onRemove} disabled={isArchived || isMutating} variant="danger" size="sm">
              移除
            </AppButton>
          </div>
        </div>
      </div>
      {isEditing && !isArchived ? (
        <form onSubmit={onSave} className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <input
            value={displayForm.displayTitleOverride}
            onChange={(event) =>
              setDisplayForm((current) => ({ ...current, displayTitleOverride: event.target.value }))
            }
            placeholder="显示标题"
            className="anime-field text-xs"
          />
          <input
            value={displayForm.coverUrlOverride}
            onChange={(event) =>
              setDisplayForm((current) => ({ ...current, coverUrlOverride: event.target.value }))
            }
            placeholder="封面 URL"
            className="anime-field text-xs"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={displayForm.animeTypeOverride}
              onChange={(event) =>
                setDisplayForm((current) => ({ ...current, animeTypeOverride: event.target.value }))
              }
              className="anime-field text-xs"
            >
              {ANIME_TYPE_OPTIONS.map((type) => (
                <option key={type || "empty"} value={type}>
                  {type || "原始类型"}
                </option>
              ))}
            </select>
            <input
              value={displayForm.tagsOverride}
              onChange={(event) =>
                setDisplayForm((current) => ({ ...current, tagsOverride: event.target.value }))
              }
              placeholder="标签，逗号分隔"
              className="anime-field text-xs"
            />
          </div>
          <input
            value={displayForm.overrideNote}
            onChange={(event) =>
              setDisplayForm((current) => ({ ...current, overrideNote: event.target.value }))
            }
            placeholder="备注"
            className="anime-field text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <AppButton type="submit" disabled={isMutating} variant="primary" size="sm">
              保存
            </AppButton>
            <AppButton type="button" onClick={onClear} disabled={isMutating} variant="ghost" size="sm">
              清除修正
            </AppButton>
            <AppButton type="button" onClick={onCancel} disabled={isMutating} variant="ghost" size="sm">
              取消
            </AppButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
