"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimeCard } from "@/components/AnimeCard";
import { AnimeCover } from "@/components/AnimeCover";
import { PageShell } from "@/components/PageShell";
import { StatusHint } from "@/components/StatusHint";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { formatAnimeSource } from "@/lib/anime-source";
import { isCommunityBattleVisiblePool } from "@/lib/community-battle-visibility";
import {
  ANIME_TAG_DICTIONARY,
  getTagGroupLabel,
  labelAnimeTag,
  normalizeTagKey,
  suggestAnimeTags,
  type AnimeTagDictionaryEntry,
  type AnimeTagGroup
} from "@/lib/anime-tag-dictionary";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getPoolAccessStateCopy,
  getPoolAccessStateFromError,
  type PoolAccessState
} from "@/lib/pool-access-state";
import {
  formatOfficialDemo,
  formatPoolVisibility,
  POOL_VISIBILITY_OPTIONS,
  type PoolVisibilityValue
} from "@/lib/pool-labels";
import {
  addAnimeToPool,
  archivePool,
  bulkImportAnimeToPool,
  clearPoolAnimeDisplayOverrides,
  createManualAnime,
  discoverAnime,
  getCommunityRanking,
  getOrCreateDefaultRun,
  getPool,
  importTierMakerItemsToPool,
  listRuns,
  previewTierMakerTemplate,
  removeAnimeFromPool,
  restorePool,
  searchBangumiAnime,
  uploadCustomItemToPool,
  uploadPoolAnimeCover,
  updatePoolAnimeDisplay,
  updatePool,
  ApiClientError,
  type BangumiSearchItem,
  type CommunityRankingResponse,
  type PersonalRun,
  type PoolAnimeEntry,
  type PoolDetail,
  type PublicAnime,
  type TierMakerPreviewItem,
} from "@/lib/client-api";
import {
  formatTierMakerAutoParseError,
  parseTierMakerUrlList,
  TIERMAKER_IMPORT_ASSISTANT_SCRIPT,
  TIERMAKER_URL_LIST_SOURCE,
  TIERMAKER_URL_LIST_TEMPLATE_NAME
} from "@/lib/tiermaker-url-list";

type AddTab = "search" | "browse" | "manual" | "custom" | "bangumi" | "tiermaker";
type DisplayOverrideForm = {
  displayTitleOverride: string;
  coverUrlOverride: string;
  animeTypeOverride: string;
  tagsOverride: string;
  overrideNote: string;
};
type CustomUploadDraft = {
  id: string;
  file: File;
  title: string;
  tags: string;
  previewUrl: string;
  error: string | null;
};

const ANIME_TYPE_OPTIONS = ["", "TV", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC", "CM", "PV", "UNKNOWN"];
const COVER_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const COVER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const TABS: { key: AddTab; label: string }[] = [
  { key: "search", label: "本地搜索" },
  { key: "browse", label: "分类浏览" },
  { key: "manual", label: "手动添加" },
  { key: "custom", label: "上传图片" },
  { key: "bangumi", label: "Bangumi 搜索" },
  { key: "tiermaker", label: "TierMaker 导入" },
];
const QUICK_SEARCH_TAG_KEYS = [
  "romance",
  "school",
  "isekai",
  "slice of life",
  "healing",
  "hot blooded",
  "action",
  "mystery",
  "fantasy",
  "comedy",
];
const QUICK_SEARCH_TAGS = QUICK_SEARCH_TAG_KEYS
  .map((key) => ANIME_TAG_DICTIONARY.find((tag) => tag.key === key))
  .filter((tag): tag is AnimeTagDictionaryEntry => tag !== undefined);
const MORE_SEARCH_TAG_GROUPS: AnimeTagGroup[] = ["类型", "场景", "氛围", "题材", "形式"];
const GROUPED_SEARCH_TAGS = MORE_SEARCH_TAG_GROUPS.map((group) => ({
  group,
  tags: ANIME_TAG_DICTIONARY
    .filter((tag) => tag.group === group)
    .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label))
}));

export default function PoolDetailPage({ params }: { params: { poolId: string } }) {
  const router = useRouter();
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [runs, setRuns] = useState<PersonalRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<PoolAccessState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [communityRanking, setCommunityRanking] = useState<CommunityRankingResponse | null>(null);
  const [isCommunityRankingLoading, setIsCommunityRankingLoading] = useState(false);
  const [communityRankingError, setCommunityRankingError] = useState<string | null>(null);
  const [communityRankingUnavailable, setCommunityRankingUnavailable] = useState(false);
  const [activeTab, setActiveTab] = useState<AddTab>("search");
  const [showMorePoolActions, setShowMorePoolActions] = useState(false);
  const [showMoreImportMethods, setShowMoreImportMethods] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<PoolVisibilityValue>("PRIVATE");
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
  const [lastSearchKeyword, setLastSearchKeyword] = useState("");
  const [lastSearchTags, setLastSearchTags] = useState<string[]>([]);
  const [selectedSearchTags, setSelectedSearchTags] = useState<string[]>([]);
  const [showMoreSearchTags, setShowMoreSearchTags] = useState(false);
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
  const [bangumiKeyword, setBangumiKeyword] = useState("");
  const [bangumiResults, setBangumiResults] = useState<BangumiSearchItem[]>([]);
  const [bangumiSearched, setBangumiSearched] = useState(false);
  const [isBangumiSearching, setIsBangumiSearching] = useState(false);
  const [bangumiAddingId, setBangumiAddingId] = useState<number | null>(null);
  const [customUploadDrafts, setCustomUploadDrafts] = useState<CustomUploadDraft[]>([]);
  const [isUploadingCustomItems, setIsUploadingCustomItems] = useState(false);
  const customUploadInputRef = useRef<HTMLInputElement>(null);
  const customUploadDraftsRef = useRef<CustomUploadDraft[]>([]);

  const [tiermakerUrl, setTiermakerUrl] = useState("");
  const [tiermakerUrlListInput, setTiermakerUrlListInput] = useState("");
  const [tiermakerAssistantCopied, setTiermakerAssistantCopied] = useState(false);
  const [tiermakerPreview, setTiermakerPreview] = useState<{
    title: string;
    sourceUrl: string;
    items: TierMakerPreviewItem[];
  } | null>(null);
  const [tiermakerPreviewLoading, setTiermakerPreviewLoading] = useState(false);
  const [tiermakerPreviewError, setTiermakerPreviewError] = useState<string | null>(null);
  const [tiermakerSelectedIndexes, setTiermakerSelectedIndexes] = useState<Set<number>>(new Set());
  const [tiermakerShowAll, setTiermakerShowAll] = useState(false);
  const [tiermakerImporting, setTiermakerImporting] = useState(false);
  const [tiermakerImportResult, setTiermakerImportResult] = useState<string | null>(null);

  const refreshRuns = useCallback(async () => {
    const data = await listRuns(params.poolId);
    setRuns(data.items);
  }, [params.poolId]);

  const refreshPool = useCallback(async () => {
    const data = await getPool(params.poolId);
    setPool(data);
    setAccessState(null);
    setEditName(data.name);
    setEditDescription(data.description ?? "");
    setEditVisibility(data.visibility);
    setEditTags(data.tags.join(", "));
  }, [params.poolId]);

  useEffect(() => {
    refreshPool()
      .catch((reason: unknown) => {
        setAccessState(getPoolAccessStateFromError(reason));
        setError(reason instanceof Error ? reason.message : "加载番组详情失败");
      })
      .finally(() => setIsLoading(false));
  }, [refreshPool]);

  useEffect(() => {
    if (pool === null) return;
    void refreshRuns().catch(() => setRuns([]));
  }, [pool, refreshRuns]);

  useEffect(() => {
    if (
      pool === null ||
      pool.visibility !== "PUBLIC" ||
      pool.status === "ARCHIVED" ||
      pool.deletedAt !== null
    ) {
      setCommunityRanking(null);
      setCommunityRankingError(null);
      setCommunityRankingUnavailable(false);
      setIsCommunityRankingLoading(false);
      return;
    }

    let cancelled = false;

    setIsCommunityRankingLoading(true);
    setCommunityRanking(null);
    setCommunityRankingError(null);
    setCommunityRankingUnavailable(false);

    getCommunityRanking(params.poolId)
      .then((data) => {
        if (cancelled) return;
        setCommunityRanking(data);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;

        setCommunityRanking(null);
        if (
          reason instanceof ApiClientError &&
          (reason.status === 403 || reason.status === 404)
        ) {
          setCommunityRankingUnavailable(true);
          return;
        }

        setCommunityRankingError("社区榜单暂时加载失败。");
      })
      .finally(() => {
        if (!cancelled) {
          setIsCommunityRankingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.poolId, pool]);

  useEffect(() => {
    customUploadDraftsRef.current = customUploadDrafts;
  }, [customUploadDrafts]);

  useEffect(() => {
    return () => {
      customUploadDraftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
    };
  }, []);

  const tagSuggestions = useMemo(
    () =>
      searchKeyword.trim()
        ? suggestAnimeTags(searchKeyword, 6).filter((tag) => !selectedSearchTags.includes(tag.key))
        : [],
    [searchKeyword, selectedSearchTags]
  );

  function clearMessage() {
    setError(null);
    setNotice(null);
  }

  function archived() {
    return (
      pool === null ||
      pool.status === "ARCHIVED" ||
      pool.status === "DELETED" ||
      pool.deletedAt !== null
    );
  }

  function resetPoolSettingsDraft() {
    if (pool === null) return;
    setEditName(pool.name);
    setEditDescription(pool.description ?? "");
    setEditVisibility(pool.visibility);
    setEditTags(pool.tags.join(", "));
  }

  async function handleSavePool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pool === null) return;
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
      setNotice("番组信息已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleArchivePool() {
    if (pool === null || archived()) return;
    if (
      !window.confirm(
        "确定归档这个番组吗？归档后它会从默认列表隐藏，历史对决和 Tier List 不会被删除。"
      )
    ) {
      return;
    }

    clearMessage();
    setIsMutating(true);

    try {
      await archivePool(pool.id);
      await refreshPool();
      setNotice("番组已归档。这个番组现在只能查看，不能继续添加或对决。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "归档失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRestorePool() {
    if (pool === null || !archived()) return;
    if (!window.confirm("恢复后你可以继续添加动画和对决。")) {
      return;
    }

    clearMessage();
    setIsMutating(true);

    try {
      await restorePool(pool.id);
      await refreshPool();
      setNotice("番组已恢复，可以继续添加动画和对决。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "恢复失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (archived() || (!searchKeyword.trim() && selectedSearchTags.length === 0)) return;
    clearMessage();
    setIsSearching(true);

    try {
      setLastSearchKeyword(searchKeyword.trim());
      setLastSearchTags(selectedSearchTags);
      const data = await discoverAnime({
        q: searchKeyword.trim() || undefined,
        tags: selectedSearchTags,
        limit: 12,
        offset: 0,
      });
      setSearchResults(data.items);
      setSearchMessage(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "搜索失败");
    } finally {
      setIsSearching(false);
    }
  }

  function toggleSearchTag(tagKey: string) {
    setSelectedSearchTags((current) =>
      current.includes(tagKey)
        ? current.filter((tag) => tag !== tagKey)
        : [...current, tagKey]
    );
  }

  function addSuggestedSearchTag(tag: AnimeTagDictionaryEntry) {
    setSelectedSearchTags((current) =>
      current.includes(tag.key) ? current : [...current, tag.key]
    );

    const normalizedQuery = normalizeTagKey(searchKeyword);
    const isExactTagQuery = [tag.key, tag.label, ...tag.aliases]
      .map(normalizeTagKey)
      .includes(normalizedQuery);

    if (isExactTagQuery) {
      setSearchKeyword("");
    }
  }

  function clearSearchFilters() {
    setSearchKeyword("");
    setSelectedSearchTags([]);
    setLastSearchKeyword("");
    setLastSearchTags([]);
    setSearchResults([]);
    setSearchMessage(null);
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

  async function handleBangumiSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (archived() || bangumiKeyword.trim().length < 2) return;
    clearMessage();
    setBangumiSearched(true);
    setIsBangumiSearching(true);

    try {
      const result = await searchBangumiAnime(bangumiKeyword.trim(), 20);
      setBangumiResults(result.items);
    } catch {
      setBangumiResults([]);
      setError("搜索失败，请稍后重试。");
    } finally {
      setIsBangumiSearching(false);
    }
  }

  async function handleAddBangumiResult(item: BangumiSearchItem) {
    if (archived()) return;
    clearMessage();
    setBangumiAddingId(item.bangumiId);
    setIsMutating(true);

    try {
      const result = await bulkImportAnimeToPool(params.poolId, String(item.bangumiId));
      await refreshPool();
      if (result.failed.length > 0) {
        setError("添加失败，请稍后重试。");
        return;
      }
      const displayTitle = item.titleCn ?? item.title;
      setNotice(
        result.added.length > 0
          ? `已加入：${displayTitle}`
          : `已在番组中：${displayTitle}`
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "添加失败，请稍后重试。");
    } finally {
      setBangumiAddingId(null);
      setIsMutating(false);
    }
  }

  async function handleTiermakerPreview() {
    if (archived() || !tiermakerUrl.trim()) return;
    clearMessage();
    setTiermakerPreviewError(null);
    setTiermakerPreviewLoading(true);
    setTiermakerImportResult(null);

    try {
      const data = await previewTierMakerTemplate(tiermakerUrl);
      setTiermakerPreview(data);
      setTiermakerSelectedIndexes(new Set(data.items.map((item) => item.sourceIndex)));
      setTiermakerShowAll(false);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "解析失败";
      setTiermakerPreviewError(formatTierMakerAutoParseError(message));
      setTiermakerPreview(null);
    } finally {
      setTiermakerPreviewLoading(false);
    }
  }

  async function copyTiermakerAssistantScript() {
    clearMessage();
    setTiermakerPreviewError(null);
    setTiermakerImportResult(null);

    try {
      await navigator.clipboard.writeText(TIERMAKER_IMPORT_ASSISTANT_SCRIPT);
      setTiermakerAssistantCopied(true);
    } catch {
      setTiermakerPreviewError("复制失败，请手动复制导入助手脚本。");
    }
  }

  function handleTiermakerUrlListPreview() {
    if (archived() || !tiermakerUrlListInput.trim()) return;
    clearMessage();
    setTiermakerPreviewError(null);
    setTiermakerImportResult(null);

    const items = parseTierMakerUrlList(tiermakerUrlListInput);

    if (items.length === 0) {
      setTiermakerPreview(null);
      setTiermakerSelectedIndexes(new Set());
      setTiermakerPreviewError("没有找到可导入的图片链接。请粘贴每行一个 URL，或使用「标题 | URL」。");
      return;
    }

    setTiermakerPreview({
      title: TIERMAKER_URL_LIST_TEMPLATE_NAME,
      sourceUrl: TIERMAKER_URL_LIST_SOURCE,
      items
    });
    setTiermakerSelectedIndexes(new Set(items.map((item) => item.sourceIndex)));
    setTiermakerShowAll(false);
  }

  function toggleTiermakerItem(sourceIndex: number) {
    setTiermakerSelectedIndexes((current) => {
      const next = new Set(current);
      if (next.has(sourceIndex)) {
        next.delete(sourceIndex);
      } else {
        next.add(sourceIndex);
      }
      return next;
    });
  }

  function selectAllTiermakerItems() {
    if (tiermakerPreview === null) return;
    setTiermakerSelectedIndexes(new Set(tiermakerPreview.items.map((item) => item.sourceIndex)));
  }

  function deselectAllTiermakerItems() {
    setTiermakerSelectedIndexes(new Set());
  }

  async function handleTiermakerImport() {
    if (pool === null || archived() || tiermakerPreview === null || tiermakerSelectedIndexes.size === 0) return;
    clearMessage();
    setTiermakerImporting(true);
    setIsMutating(true);

    try {
      const selectedIndexes = Array.from(tiermakerSelectedIndexes);
      const result =
        tiermakerPreview.sourceUrl === TIERMAKER_URL_LIST_SOURCE
          ? await importTierMakerItemsToPool(pool.id, {
              templateUrl: TIERMAKER_URL_LIST_SOURCE,
              templateName: TIERMAKER_URL_LIST_TEMPLATE_NAME,
              items: tiermakerPreview.items
                .filter((item) => tiermakerSelectedIndexes.has(item.sourceIndex))
                .map((item) => ({
                  title: item.title,
                  imageUrl: item.imageUrl,
                  index: item.sourceIndex,
                  tags: ["tiermaker", "imported", "url-list"]
                }))
            })
          : await importTierMakerItemsToPool(pool.id, {
              url: tiermakerUrl,
              selectedIndexes
            });
      await refreshPool();
      setTiermakerImportResult(
        `导入完成：新增 ${result.importedCount} 部，跳过 ${result.skippedCount} 部`
      );
      setTiermakerUrl("");
      setTiermakerUrlListInput("");
      setTiermakerPreview(null);
      setTiermakerSelectedIndexes(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败");
    } finally {
      setTiermakerImporting(false);
      setIsMutating(false);
    }
  }

  function handleCustomFileChange(event: ChangeEvent<HTMLInputElement>) {
    addCustomUploadFiles(event.target.files);
    event.target.value = "";
  }

  function handleCustomDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addCustomUploadFiles(event.dataTransfer.files);
  }

  function addCustomUploadFiles(files: FileList | null) {
    if (files === null || archived()) return;
    const drafts = Array.from(files).map((file) => {
      const error = validateCustomUploadFile(file);
      return {
        id: makeDraftId(),
        file,
        title: titleFromFileName(file.name),
        tags: "",
        previewUrl: URL.createObjectURL(file),
        error
      };
    });

    setCustomUploadDrafts((current) => [...current, ...drafts]);
  }

  function updateCustomDraft(id: string, patch: Partial<Pick<CustomUploadDraft, "title" | "tags">>) {
    setCustomUploadDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
    );
  }

  function removeCustomDraft(id: string) {
    setCustomUploadDrafts((current) => {
      const target = current.find((draft) => draft.id === id);
      if (target !== undefined) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((draft) => draft.id !== id);
    });
  }

  async function handleUploadCustomItems() {
    if (pool === null || archived() || customUploadDrafts.length === 0) return;
    clearMessage();
    setIsUploadingCustomItems(true);
    setIsMutating(true);

    try {
      const failedDrafts: CustomUploadDraft[] = [];
      let uploadedCount = 0;

      for (const draft of customUploadDrafts) {
        const validationError = draft.error ?? validateCustomUploadFile(draft.file);

        if (validationError !== null) {
          failedDrafts.push({ ...draft, error: validationError });
          continue;
        }

        try {
          await uploadCustomItemToPool(pool.id, {
            file: draft.file,
            title: draft.title,
            tags: draft.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          });
          uploadedCount++;
          URL.revokeObjectURL(draft.previewUrl);
        } catch (reason) {
          failedDrafts.push({
            ...draft,
            error: reason instanceof Error ? reason.message : "上传失败"
          });
        }
      }

      setCustomUploadDrafts(failedDrafts);
      await refreshPool();
      setNotice(`已上传并加入 ${uploadedCount} 张图片${failedDrafts.length > 0 ? `，${failedDrafts.length} 张失败` : ""}`);
    } finally {
      setIsUploadingCustomItems(false);
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

  async function handleSaveDisplay(
    event: FormEvent<HTMLFormElement>,
    coverUrlOverride?: string
  ) {
    event.preventDefault();
    if (pool === null || archived() || editingDisplayAnimeId === null) return;

    clearMessage();
    setIsMutating(true);

    try {
      await updatePoolAnimeDisplay(pool.id, editingDisplayAnimeId, {
        displayTitleOverride: displayForm.displayTitleOverride,
        coverUrlOverride: coverUrlOverride ?? displayForm.coverUrlOverride,
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
        <PoolAccessStateCard state={accessState ?? "not-found"} fallbackMessage={error} />
      </PageShell>
    );
  }

  const isArchived = archived();
  const latestRun = runs[0];
  const permissions = pool.permissions;
  const canManagePool = permissions?.canManage ?? false;
  const canAddAnimeToPool = permissions?.canAddAnime ?? canManagePool;
  const canPlayPool = permissions?.canPlay ?? canManagePool;
  const canReadCommunityMatch = permissions?.canCommunityMatch ?? false;
  const canStart = pool.anime.length >= 2 && !isArchived && canPlayPool;
  const canPromptLoginToMatch =
    pool.anime.length >= 2 && !isArchived && !canPlayPool && (permissions?.canRead ?? false);
  const canShowCommunityRanking =
    pool.visibility === "PUBLIC" && !isArchived && !communityRankingUnavailable;
  const joinedAnimeIds = new Set(pool.anime.map((entry) => entry.animeId));
  const joinedBangumiIds = new Set(
    pool.anime
      .map((entry) => entry.anime.bgmId)
      .filter((bgmId): bgmId is number => bgmId !== null)
  );
  const canShowCommunityBattle = isCommunityBattleVisiblePool(pool);
  const canPromptLoginToBattle =
    canShowCommunityBattle && !canPlayPool && (permissions?.canRead ?? false);
  const loginToPoolPath = `/login?next=${encodeURIComponent(`/pools/${params.poolId}`)}`;
  const poolGuidance = getPoolGuidance(pool.anime.length, isArchived);
  const sourceSummary = formatPoolSourceSummary(pool.anime.map((entry) => entry.anime.source));
  const selectedDisplayEntry =
    editingDisplayAnimeId === null
      ? null
      : pool.anime.find((entry) => entry.animeId === editingDisplayAnimeId) ?? null;
  const searchHadNoResults =
    (lastSearchKeyword.length > 0 || lastSearchTags.length > 0) && !isSearching && searchResults.length === 0;
  const poolOnboardingHint = canManagePool
    ? "你可以在番组设置里切换公开/私有，并继续维护作品墙。"
    : canPlayPool
      ? "你的对决和榜单只属于你，不会影响创建者。"
      : "你可以先浏览作品墙，登录后开始自己的个人对决。";

  return (
    <PageShell>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone={isArchived ? "danger" : "status"}>
              {isArchived ? "已归档" : formatPoolVisibility(pool.visibility)}
            </AppBadge>
            {formatOfficialDemo(pool.isOfficialDemo) ? (
              <AppBadge tone="source">{formatOfficialDemo(pool.isOfficialDemo)}</AppBadge>
            ) : null}
            <AppBadge tone="muted">{pool.anime.length} 部动画</AppBadge>
            <AppBadge tone="source">{sourceSummary}</AppBadge>
            <AppBadge tone={canStart ? "success" : "warning"}>
              {canStart ? "可开始" : "待添加"}
            </AppBadge>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
            {pool.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            {pool.description ?? "暂无描述"}
          </p>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-cyan-100">
            下一步：{poolGuidance.title}
          </p>
          {pool.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {pool.tags.map((tag) => (
                <AppBadge key={tag} tone="muted">
                  {labelAnimeTag(tag)}
                </AppBadge>
              ))}
            </div>
          ) : null}
        </div>
        <AppCard className="p-5" variant="focus">
          <div className="grid gap-3">
            {canShowCommunityBattle ? (
              <>
                <AppButton
                  onClick={() =>
                    canPromptLoginToBattle ? router.push(loginToPoolPath) : enterRun("match")
                  }
                  disabled={(!canStart && !canPromptLoginToBattle) || isMutating}
                  variant="primary"
                  size="lg"
                >
                  {canPromptLoginToBattle ? "登录后参与大乱斗" : "加入社区大乱斗"}
                </AppButton>
                <p className="text-xs leading-5 text-slate-500">
                  每个人都有自己的对决和榜单，你的选择会以匿名聚合的方式贡献到社区榜单。不会影响创建者的作品墙，也不会覆盖你的个人 Tier List。
                  不会公开你的单次选择或个人身份，只展示匿名聚合结果。
                </p>
              </>
            ) : (
              <AppButton
                onClick={() =>
                  canPromptLoginToMatch ? router.push(loginToPoolPath) : enterRun("match")
                }
                disabled={(!canStart && !canPromptLoginToMatch) || isMutating}
                variant="primary"
                size="lg"
              >
                {canPromptLoginToMatch
                  ? "登录后开始个人对决"
                  : canManagePool
                    ? "开始对决"
                    : "开始我的对决"}
              </AppButton>
            )}
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
            {canShowCommunityRanking ? (
              <Link
                href="#community-ranking"
                className={appButtonClasses({ variant: "ghost" })}
              >
                查看社区榜单
              </Link>
            ) : null}
            {canManagePool ? (
              <AppButton
                onClick={() => setShowMorePoolActions((value) => !value)}
                variant="quiet"
                size="sm"
                aria-expanded={showMorePoolActions}
              >
                更多番组操作
              </AppButton>
            ) : null}
            <Link href="/pools" className={appButtonClasses({ variant: "quiet", size: "sm" })}>
              返回我的番组
            </Link>
            {!canManagePool && canPlayPool ? (
              <p className="mt-2 text-center text-xs leading-5 text-slate-500">
                你的对决和榜单只属于你，不会影响创建者。
              </p>
            ) : null}
          </div>
        </AppCard>
      </section>

      <div className="mt-5 space-y-3">
        {isArchived ? (
          <ErrorAlert
            message="这个番组已归档，只能查看，不能继续添加或对决。"
            tone="warning"
          />
        ) : null}
        <StatusHint
          label="新手提示"
          title="这个番组可以这样玩"
          description={poolOnboardingHint}
          tone="guide"
        />
        {canShowCommunityBattle ? (
          <StatusHint
            label="社区大乱斗"
            title="公开番组的共同榜单玩法"
            description="每个人都有自己的对决和榜单，你的选择会以匿名聚合的方式贡献到社区榜单。不会影响创建者的作品墙，也不会覆盖你的个人 Tier List。不会公开你的单次选择或个人身份，只展示匿名聚合结果。"
            tone="guide"
          />
        ) : null}
        <StatusHint
          label={poolGuidance.label}
          title={poolGuidance.title}
          description={poolGuidance.description}
          tone={poolGuidance.tone}
        />
        {error ? <ErrorAlert message={error} /> : null}
        {notice ? <ErrorAlert message={notice} tone="notice" /> : null}
      </div>

      {showMorePoolActions && canManagePool ? (
        <AppCard className="mt-6 p-5" variant="soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">番组设置</h2>
              <p className="mt-1 text-sm text-slate-400">
                管理基本信息、可见性和归档状态。编辑、导入和归档仍只有创建者可以操作。
              </p>
            </div>
          </div>
          <form onSubmit={handleSavePool} className="mt-5 space-y-5 border-t border-anime-border pt-5">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-white">基本信息</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  名称、描述和标签会显示在番组详情与番组列表。
                </p>
              </div>
              <label className="block text-xs font-semibold text-slate-300" htmlFor="pool-name">
                名称
              </label>
              <input
                id="pool-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="anime-field"
              />
              <label className="block text-xs font-semibold text-slate-300" htmlFor="pool-description">
                描述
              </label>
              <textarea
                id="pool-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="anime-field min-h-24"
              />
              <label className="block text-xs font-semibold text-slate-300" htmlFor="pool-tags">
                标签
              </label>
              <input
                id="pool-tags"
                value={editTags}
                onChange={(event) => setEditTags(event.target.value)}
                placeholder="标签，逗号分隔"
                className="anime-field"
              />
            </section>

            <section className="space-y-3 border-t border-anime-border pt-5">
              <div className="grid gap-3 md:grid-cols-[1fr_260px]">
                <div>
                  <h3 className="text-sm font-semibold text-white">可见性</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    可见性只影响谁能浏览和开始个人对决，不开放编辑权限。
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300" htmlFor="pool-visibility">
                    当前可见性
                  </label>
                  <select
                    id="pool-visibility"
                    value={editVisibility}
                    onChange={(event) =>
                      setEditVisibility(event.target.value as PoolVisibilityValue)
                    }
                    className="anime-field mt-2"
                  >
                    {POOL_VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-2 text-xs leading-5 text-slate-400 md:grid-cols-3">
                {POOL_VISIBILITY_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`rounded-lg border p-3 ${
                      editVisibility === option.value
                        ? "border-cyan-300/50 bg-cyan-300/[0.08]"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <p className="font-semibold text-slate-200">{option.label}</p>
                    <p className="mt-1">{option.description}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-semibold text-slate-300">公开说明文案</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  公开番组会出现在公开番组页，登录后任何人都可以开始自己的个人对决。管理操作仍只有创建者可以使用。
                </p>
              </div>
            </section>

            <section className="space-y-3 border-t border-anime-border pt-5">
              <div>
                <h3 className="text-sm font-semibold text-white">公开权限，暂未开放</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  这些功能还在设计中，当前公开番组只支持他人浏览并进行个人对决。
                </p>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-500">
                <input type="checkbox" disabled className="h-4 w-4 accent-cyan-400" />
                允许其他人添加动画
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-500">
                <input type="checkbox" disabled className="h-4 w-4 accent-cyan-400" />
                启用大乱斗公共榜单
              </label>
            </section>

            <section className="space-y-3 border-t border-anime-border pt-5">
              <div>
                <h3 className="text-sm font-semibold text-white">危险操作</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  归档会隐藏默认列表入口，但不会删除历史对决和 Tier List。
                </p>
              </div>
              {isArchived ? (
                <AppButton
                  type="button"
                  onClick={handleRestorePool}
                  disabled={isMutating}
                  variant="secondary"
                  size="sm"
                >
                  恢复番组
                </AppButton>
              ) : (
                <AppButton
                  type="button"
                  onClick={handleArchivePool}
                  disabled={isMutating}
                  variant="danger"
                  size="sm"
                >
                  归档番组
                </AppButton>
              )}
            </section>

            <div className="flex flex-wrap gap-2 border-t border-anime-border pt-5">
              <AppButton type="submit" disabled={isMutating} variant="primary">
                保存设置
              </AppButton>
              <AppButton
                type="button"
                onClick={() => {
                  resetPoolSettingsDraft();
                  setShowMorePoolActions(false);
                }}
                disabled={isMutating}
                variant="ghost"
              >
                取消
              </AppButton>
              <Link href="/pools" className={appButtonClasses({ variant: "quiet", size: "sm" })}>
                返回我的番组
              </Link>
            </div>
          </form>
        </AppCard>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_410px]">
        <AppCard className="p-5">
          <SectionHeader
            eyebrow="Anime pool"
            title="作品墙"
            description="封面优先展示；显示修正和移除操作保持低调。"
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
                  canManage={canManagePool}
                  isMutating={isMutating}
                  onEdit={() => startEditingDisplay(entry)}
                  onRemove={() => handleRemove(entry.animeId)}
                />
              ))}
            </div>
          )}
        </AppCard>

        <div className="space-y-5">
        {selectedDisplayEntry !== null && canManagePool ? (
          <PoolAnimeDisplayPanel
            entry={selectedDisplayEntry}
            isMutating={isMutating}
            displayForm={displayForm}
            setDisplayForm={setDisplayForm}
            onSave={handleSaveDisplay}
            onClear={() => handleClearDisplay(selectedDisplayEntry.animeId)}
            onCancel={() => setEditingDisplayAnimeId(null)}
            onUploaded={refreshPool}
          />
        ) : null}

        {canAddAnimeToPool ? (
        <AppCard id="add-anime" className="p-5">
          <SectionHeader eyebrow="Add anime" title="添加动画" />
          {isArchived ? (
            <p className="mt-4 text-sm text-slate-400">归档番组不能继续添加动画。</p>
          ) : (
            <>
              <div className="mt-4 border-b border-anime-border pb-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("search")}
                    className={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition duration-anime ${
                      activeTab === "search"
                        ? "border-anime-cyan/50 bg-anime-cyan/12 text-cyan-100"
                        : "border-anime-border bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    本地搜索
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMoreImportMethods((value) => !value)}
                    className="min-h-11 rounded-full border border-anime-border bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-300 transition duration-anime hover:text-white"
                    aria-expanded={showMoreImportMethods}
                  >
                    更多导入方式
                  </button>
                </div>
                {showMoreImportMethods ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {TABS.filter((tab) => tab.key !== "search").map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`min-h-10 rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-anime ${
                          activeTab === tab.key
                            ? "border-anime-purple/50 bg-anime-purple/12 text-purple-100"
                            : "border-anime-border bg-white/[0.03] text-slate-400 hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                ) : activeTab !== "search" ? (
                  <div className="mt-3">
                    <AppButton type="button" variant="quiet" size="sm" onClick={() => setActiveTab("search")}>
                      收起导入方式并返回本地搜索
                    </AppButton>
                  </div>
                ) : null}
              </div>

              {activeTab === "search" ? (
                <div className="mt-4">
                  <StatusHint
                    label="本地搜索"
                    title="先选标签，再搜关键词"
                    description="可以先选“恋爱 / 校园 / 异世界”等标签，再输入关键词二次检索。"
                    tone="guide"
                    className="mb-4"
                  />
                  <form onSubmit={handleSearch} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      placeholder="输入动画名、别名或制作社"
                      className="anime-field min-w-0 flex-1"
                    />
                    <AppButton type="submit" disabled={isSearching} variant="primary">
                      搜索
                    </AppButton>
                  </form>
                  {tagSuggestions.length > 0 ? (
                    <div className="mt-2 rounded-xl border border-cyan-300/20 bg-slate-950/75 p-2">
                      <p className="px-2 pb-1 text-[11px] font-semibold text-slate-500">标签联想</p>
                      <div className="grid gap-1">
                        {tagSuggestions.map((tag) => (
                          <button
                            key={tag.key}
                            type="button"
                            onClick={() => addSuggestedSearchTag(tag)}
                            className="min-w-0 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.06]"
                          >
                            <span className="block text-sm font-semibold text-cyan-100">{tag.label}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {formatTagSuggestionMeta(tag)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-slate-400">常用标签</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_SEARCH_TAGS.map((tag) => {
                        const selected = selectedSearchTags.includes(tag.key);
                        return (
                          <button
                            key={tag.key}
                            type="button"
                            onClick={() => toggleSearchTag(tag.key)}
                            className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-anime ${
                              selected
                                ? "border-cyan-300/60 bg-cyan-300/12 text-cyan-100"
                                : "border-anime-border bg-white/[0.03] text-slate-400 hover:text-white"
                            }`}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3">
                    <AppButton
                      type="button"
                      onClick={() => setShowMoreSearchTags((value) => !value)}
                      variant="quiet"
                      size="sm"
                      aria-expanded={showMoreSearchTags}
                    >
                      更多标签
                    </AppButton>
                  </div>
                  {showMoreSearchTags ? (
                    <div className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      {GROUPED_SEARCH_TAGS.map((group) => (
                        <div key={group.group} className="min-w-0">
                          <p className="mb-2 text-xs font-semibold text-slate-400">
                            {getTagGroupLabel(group.group)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {group.tags.map((tag) => {
                              const selected = selectedSearchTags.includes(tag.key);
                              return (
                                <button
                                  key={tag.key}
                                  type="button"
                                  onClick={() => toggleSearchTag(tag.key)}
                                  className={`min-h-8 rounded-full border px-3 py-1 text-xs font-semibold transition duration-anime ${
                                    selected
                                      ? "border-purple-300/60 bg-purple-300/12 text-purple-100"
                                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                                  }`}
                                >
                                  {tag.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {selectedSearchTags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {selectedSearchTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleSearchTag(tag)}
                          className="min-h-8 rounded-full border border-cyan-300/35 bg-cyan-300/[0.08] px-3 py-1 text-xs font-semibold text-cyan-100"
                        >
                          {labelAnimeTag(tag)}
                        </button>
                      ))}
                      <AppButton type="button" onClick={clearSearchFilters} variant="quiet" size="sm">
                        清空筛选
                      </AppButton>
                    </div>
                  ) : null}
                  {searchMessage ? <p className="mt-3 text-sm text-slate-400">{searchMessage}</p> : null}
                  {searchHadNoResults ? (
                    <StatusHint
                      label="无结果"
                      title="没有找到匹配动画"
                      description={
                        hasChineseText(lastSearchKeyword)
                          ? "可以换用英文、日文或更短关键词再试；当前数据库可能还不是全量导入。也可以切到“手动添加”先创建条目。"
                          : "可以换用更短关键词、原标题或别名再试；也可以切到“手动添加”先创建条目。"
                      }
                      tone="warning"
                      className="mt-4"
                    />
                  ) : null}
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
                  <p className="text-xs leading-5 text-slate-500">
                    如果外部封面加载失败，页面会自动显示 fallback，不会阻塞对决。
                  </p>
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

              {activeTab === "custom" ? (
                <div className="mt-4 space-y-4">
                  <StatusHint
                    label="自定义图片池"
                    title="上传本地图片作为参赛项"
                    description="适合角色图、头像、海报或场景图排序。每张图片会作为当前番组内的条目参与 Match 和 Tier List，不会进入 Manami 搜索。"
                    tone="guide"
                  />
                  <input
                    ref={customUploadInputRef}
                    type="file"
                    accept={COVER_UPLOAD_ACCEPT}
                    multiple
                    onChange={handleCustomFileChange}
                    className="hidden"
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => customUploadInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        customUploadInputRef.current?.click();
                      }
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleCustomDrop}
                    className="rounded-2xl border border-dashed border-purple-300/30 bg-purple-300/[0.06] p-5 text-center text-sm leading-6 text-slate-300 transition hover:border-purple-300/50 hover:bg-purple-300/[0.09]"
                  >
                    <p className="font-semibold text-purple-100">拖拽图片到这里，或点击选择多张文件</p>
                    <p className="mt-1 text-xs text-slate-500">支持 jpg/png/webp/gif，单张最大 5MB，不支持 svg。</p>
                  </div>

                  {customUploadDrafts.length > 0 ? (
                    <div className="space-y-3">
                      {customUploadDrafts.map((draft) => (
                        <div
                          key={draft.id}
                          className="rounded-2xl border border-white/10 bg-slate-950/45 p-3"
                        >
                          <div className="flex gap-3">
                            <div
                              className="h-20 w-14 shrink-0 rounded-xl bg-cover bg-center"
                              style={{ backgroundImage: `url(${draft.previewUrl})` }}
                            />
                            <div className="min-w-0 flex-1 space-y-2">
                              <input
                                value={draft.title}
                                onChange={(event) =>
                                  updateCustomDraft(draft.id, { title: event.target.value })
                                }
                                placeholder="图片标题"
                                className="anime-field text-xs"
                              />
                              <input
                                value={draft.tags}
                                onChange={(event) =>
                                  updateCustomDraft(draft.id, { tags: event.target.value })
                                }
                                placeholder="标签，逗号分隔（可选）"
                                className="anime-field text-xs"
                              />
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                <span>{formatFileSize(draft.file.size)}</span>
                                <button
                                  type="button"
                                  onClick={() => removeCustomDraft(draft.id)}
                                  className="text-rose-200 hover:text-rose-100"
                                >
                                  移除
                                </button>
                              </div>
                              {draft.error ? (
                                <p className="text-xs leading-5 text-rose-200">{draft.error}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                      <AppButton
                        type="button"
                        onClick={handleUploadCustomItems}
                        disabled={isUploadingCustomItems || isMutating}
                        variant="primary"
                        className="w-full"
                      >
                        {isUploadingCustomItems ? "上传中..." : "上传并加入番组"}
                      </AppButton>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "bangumi" ? (
                <div className="mt-4 space-y-4">
                  <StatusHint
                    label="Bangumi 搜索"
                    title="从 Bangumi 添加公开条目"
                    description="从 Bangumi 搜索公开条目并添加到当前番组。"
                    tone="guide"
                  />
                  <form onSubmit={handleBangumiSearch} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      value={bangumiKeyword}
                      onChange={(event) => setBangumiKeyword(event.target.value)}
                      placeholder="输入 Bangumi 关键词"
                      className="anime-field min-w-0 flex-1"
                    />
                    <AppButton
                      type="submit"
                      disabled={isBangumiSearching || bangumiKeyword.trim().length < 2}
                      variant="primary"
                    >
                      搜索
                    </AppButton>
                  </form>
                  {bangumiSearched && !isBangumiSearching && bangumiResults.length === 0 ? (
                    <StatusHint
                      label="无结果"
                      title="没有找到匹配条目。"
                      description="可以换用原标题、中文名或更短关键词再试。"
                      tone="warning"
                    />
                  ) : null}
                  <div className="space-y-3">
                    {bangumiResults.map((item) => {
                      const alreadyJoined = joinedBangumiIds.has(item.bangumiId);

                      return (
                        <BangumiResultCard
                          key={item.bangumiId}
                          item={item}
                          disabled={isMutating || alreadyJoined}
                          isAdding={bangumiAddingId === item.bangumiId}
                          actionLabel={
                            alreadyJoined
                              ? "已加入"
                              : bangumiAddingId === item.bangumiId
                                ? "添加中..."
                                : "添加到当前番组"
                          }
                          onAdd={() => handleAddBangumiResult(item)}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {activeTab === "tiermaker" ? (
                <div className="mt-4 space-y-4">
                  <StatusHint
                    label="TierMaker 导入"
                    title="TierMaker 导入助手"
                    description="如果自动解析失败，可以复制导入助手脚本，在 TierMaker 页面运行后粘贴图片链接。"
                    tone="guide"
                  />

                  <div className="rounded-2xl border border-anime-border bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">TierMaker 导入助手</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          脚本只读取当前页面 document.images，复制去重后的图片链接，不下载图片、不上传数据、不读取 cookie。
                        </p>
                      </div>
                      <AppButton type="button" onClick={copyTiermakerAssistantScript} variant="primary" size="sm">
                        复制导入助手脚本
                      </AppButton>
                    </div>
                    {tiermakerAssistantCopied ? (
                      <p className="mt-2 text-xs text-cyan-200">导入助手脚本已复制。</p>
                    ) : null}
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-300">
                      <li>打开 TierMaker 模板页面</li>
                      <li>按 F12 打开 Console</li>
                      <li>粘贴脚本并回车</li>
                      <li>回到 AniMatch 粘贴图片链接</li>
                    </ol>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      图片 URL 列表
                    </label>
                    <textarea
                      value={tiermakerUrlListInput}
                      onChange={(event) => setTiermakerUrlListInput(event.target.value)}
                      placeholder={"每行一个 URL\n标题 | https://tiermaker.com/images/example.png"}
                      className="anime-field min-h-36"
                    />
                    <AppButton
                      type="button"
                      onClick={handleTiermakerUrlListPreview}
                      disabled={isMutating || !tiermakerUrlListInput.trim()}
                      variant="primary"
                      className="w-full"
                    >
                      解析图片链接
                    </AppButton>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-anime-border bg-slate-950/35 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      可选：自动解析模板链接
                    </p>
                    <p className="text-xs leading-5 text-slate-400">
                      如果目标网站允许服务器访问，可以直接粘贴公开模板链接；失败时请使用上方导入助手脚本。
                    </p>
                    <div className="flex gap-2">
                    <input
                      value={tiermakerUrl}
                      onChange={(event) => setTiermakerUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleTiermakerPreview();
                      }}
                      placeholder="https://tiermaker.com/create/..."
                      className="anime-field min-w-0 flex-1"
                    />
                    <AppButton
                      type="button"
                      onClick={handleTiermakerPreview}
                      disabled={tiermakerPreviewLoading || isMutating || !tiermakerUrl.trim()}
                      variant="primary"
                    >
                      {tiermakerPreviewLoading ? "解析中..." : "解析模板"}
                    </AppButton>
                    </div>
                  </div>

                  {tiermakerPreviewError ? (
                    <ErrorAlert message={tiermakerPreviewError} />
                  ) : null}

                  {tiermakerImportResult ? (
                    <ErrorAlert message={tiermakerImportResult} tone="notice" />
                  ) : null}

                  {tiermakerPreview !== null ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{tiermakerPreview.title}</p>
                          <p className="text-xs text-slate-400">
                            共 {tiermakerPreview.items.length} 项，已选 {tiermakerSelectedIndexes.size} 项
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <AppButton
                            type="button"
                            onClick={selectAllTiermakerItems}
                            disabled={isMutating}
                            variant="ghost"
                            size="sm"
                          >
                            全选
                          </AppButton>
                          <AppButton
                            type="button"
                            onClick={deselectAllTiermakerItems}
                            disabled={isMutating}
                            variant="ghost"
                            size="sm"
                          >
                            取消全选
                          </AppButton>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {tiermakerPreview.items
                          .slice(0, tiermakerShowAll ? tiermakerPreview.items.length : Math.min(50, tiermakerPreview.items.length))
                          .map((item) => {
                            const isSelected = tiermakerSelectedIndexes.has(item.sourceIndex);
                            return (
                              <div
                                key={item.sourceIndex}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleTiermakerItem(item.sourceIndex)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    toggleTiermakerItem(item.sourceIndex);
                                  }
                                }}
                                className={`overflow-hidden rounded-xl border transition duration-anime ${
                                  isSelected
                                    ? "border-anime-cyan/60 bg-anime-cyan/[0.08] ring-1 ring-anime-cyan/30"
                                    : "border-anime-border bg-white/[0.03] hover:border-anime-cyan/25"
                                }`}
                              >
                                <AnimeCover
                                  src={item.imageUrl}
                                  secondarySrc={null}
                                  title={item.title}
                                  size="sm"
                                  className="aspect-[3/4] w-full rounded-none border-0"
                                />
                                <div className="flex items-center gap-2 p-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleTiermakerItem(item.sourceIndex)}
                                    className="h-4 w-4 accent-cyan-400"
                                  />
                                  <p className="line-clamp-1 min-w-0 text-xs text-slate-300">
                                    {item.title}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {tiermakerPreview.items.length > 50 ? (
                        <AppButton
                          type="button"
                          onClick={() => setTiermakerShowAll((value) => !value)}
                          variant="quiet"
                          size="sm"
                          className="w-full"
                        >
                          {tiermakerShowAll
                            ? "收起"
                            : `显示全部 ${tiermakerPreview.items.length} 项`}
                        </AppButton>
                      ) : null}

                      <AppButton
                        type="button"
                        onClick={handleTiermakerImport}
                        disabled={
                          tiermakerImporting ||
                          isMutating ||
                          tiermakerSelectedIndexes.size === 0
                        }
                        variant="primary"
                        className="w-full"
                      >
                        {tiermakerImporting
                          ? "导入中..."
                          : `导入选中 (${tiermakerSelectedIndexes.size})`}
                      </AppButton>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </AppCard>
        ) : null}
        </div>
      </section>

      {canShowCommunityRanking ? (
        <CommunityRankingSection
          ranking={communityRanking}
          isLoading={isCommunityRankingLoading}
          error={communityRankingError}
        />
      ) : null}

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

function CommunityRankingSection({
  ranking,
  isLoading,
  error
}: {
  ranking: CommunityRankingResponse | null;
  isLoading: boolean;
  error: string | null;
}) {
  const hasItems = (ranking?.items.length ?? 0) > 0;

  return (
    <section id="community-ranking" className="mt-8 scroll-mt-24">
      <AppCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            eyebrow="Community"
            title="社区榜单"
            description="基于所有用户在这个公开番组中的个人对决结果实时聚合；不会影响你的个人榜单。"
          />
          <AppBadge tone="source" className="w-fit">
            实时聚合
          </AppBadge>
        </div>

        {ranking ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CommunityRankingMetric
              label="参与人数"
              value={String(ranking.totalParticipants)}
            />
            <CommunityRankingMetric label="活跃轮次" value={String(ranking.totalRuns)} />
            <CommunityRankingMetric label="作品数" value={String(ranking.totalAnime)} />
            <CommunityRankingMetric
              label="样本阈值"
              value={`至少 ${ranking.minSampleThreshold.minUsers} 人 / ${ranking.minSampleThreshold.minComparisons} 次`}
              compact
            />
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-cyan-300/18 bg-cyan-300/[0.07] p-4">
          <AppBadge tone="source">样本说明</AppBadge>
          <h3 className="mt-3 text-sm font-semibold text-white">
            参与人数或有效比较次数还不够时，排名仅供参考
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            样本不足的作品会保留在列表中，但不会获得正式排名。登录后开始对决，也可以帮助这个番组生成社区榜单。
          </p>
        </div>

        {isLoading ? (
          <ErrorAlert message="正在加载社区榜单..." tone="notice" className="mt-5" />
        ) : null}
        {error ? <ErrorAlert message={error} className="mt-5" /> : null}

        {!isLoading && error === null && ranking === null ? (
          <div className="mt-5">
            <EmptyState
              title="这个番组暂时没有社区榜单"
              description="公开番组积累更多个人对决后，会在这里展示社区聚合结果。"
            />
          </div>
        ) : null}

        {!isLoading && error === null && ranking !== null && !hasItems ? (
          <div className="mt-5">
            <EmptyState
              title="还没有足够的社区对决数据。"
              description="登录后开始对决，也可以帮助这个番组生成社区榜单。"
            />
          </div>
        ) : null}

        {ranking !== null && hasItems ? (
          <div className="mt-5 grid gap-3">
            {ranking.items.map((item) => (
              <CommunityRankingCard key={item.animeId} item={item} />
            ))}
          </div>
        ) : null}
      </AppCard>
    </section>
  );
}

function CommunityRankingMetric({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 font-black leading-tight text-white [overflow-wrap:anywhere] ${
          compact ? "text-sm" : "text-2xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CommunityRankingCard({
  item
}: {
  item: CommunityRankingResponse["items"][number];
}) {
  const scoreText =
    item.communityScore === null ? "--" : formatCommunityRating(item.communityScore);
  const averageText =
    item.averageRating === null ? "--" : formatCommunityRating(item.averageRating);

  return (
    <div className="grid min-w-0 gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 sm:grid-cols-[72px_minmax(0,1fr)_minmax(120px,auto)] sm:items-center">
      <div className="flex items-center gap-3 sm:block">
        <AnimeCover
          src={item.imageUrl}
          title={item.title}
          size="sm"
          className="h-24 w-16 shrink-0 rounded-lg sm:h-24 sm:w-full"
        />
        <div className="sm:hidden">
          <CommunityRankingRank item={item} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="hidden sm:block">
          <CommunityRankingRank item={item} />
        </div>
        <h3 className="mt-2 line-clamp-2 break-words text-base font-semibold text-white sm:mt-1">
          {item.title}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {item.insufficientSample ? <AppBadge tone="warning">样本不足</AppBadge> : null}
          <AppBadge tone="muted">{item.participantCount} 人参与</AppBadge>
          <AppBadge tone="muted">{item.comparisonCount} 次有效比较</AppBadge>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:w-36 sm:grid-cols-1">
        <CommunityScoreCell label="社区分" value={scoreText} strong />
        <CommunityScoreCell label="平均 Elo" value={averageText} />
      </div>
    </div>
  );
}

function CommunityRankingRank({
  item
}: {
  item: CommunityRankingResponse["items"][number];
}) {
  return item.rank !== null ? (
    <AppBadge tone="success">#{item.rank}</AppBadge>
  ) : (
    <AppBadge tone="warning">样本不足</AppBadge>
  );
}

function CommunityScoreCell({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={`mt-1 leading-tight [overflow-wrap:anywhere] ${
          strong ? "text-lg font-black text-cyan-100" : "text-sm font-semibold text-slate-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatCommunityRating(value: number) {
  return value.toFixed(1);
}

function PoolAccessStateCard({
  state,
  fallbackMessage
}: {
  state: PoolAccessState;
  fallbackMessage?: string | null;
}) {
  const copy = getPoolAccessStateCopy(state);
  const shouldShowFallback = state === "not-found" && fallbackMessage;

  return (
    <div className="mx-auto max-w-2xl">
      <EmptyState
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            {copy.actions.map((action) => (
              <Link
                key={action.href}
                className={appButtonClasses({ variant: action.variant, size: "md" })}
                href={action.href}
              >
                {action.label}
              </Link>
            ))}
          </div>
        }
      />
      {shouldShowFallback ? (
        <div className="mt-4">
          <ErrorAlert message={fallbackMessage} />
        </div>
      ) : null}
    </div>
  );
}

function formatPoolSourceSummary(sources: string[]) {
  const labels = [...new Set(sources.map(formatAnimeSource).filter(Boolean))];

  if (labels.length === 0) {
    return "Unknown";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `Mixed: ${labels.join(" / ")}`;
}

function getPoolGuidance(animeCount: number, isArchived: boolean) {
  if (isArchived) {
    return {
      label: "只读",
      title: "该番组已归档",
      description: "该番组已归档，只能查看历史结果。如需继续对决，请新建或复制番组。",
      tone: "warning" as const
    };
  }

  if (animeCount === 0) {
    return {
      label: "下一步",
      title: "先添加几部动画",
      description: "建议至少添加 4 部，这样系统才能生成更稳定的对决和 Tier List。",
      tone: "guide" as const
    };
  }

  if (animeCount === 1) {
    return {
      label: "还差一步",
      title: "还需要至少 1 部动画才能开始对决",
      description: "建议添加 4-8 部进行第一次体验，动画越多，排序越有参考价值。",
      tone: "warning" as const
    };
  }

  if (animeCount < 4) {
    return {
      label: "可开始",
      title: "已经可以开始对决，但 pair 很少",
      description: "添加更多动画可以让 Tier List 更准确；现在也可以先体验一次完整流程。",
      tone: "success" as const
    };
  }

  return {
    label: "准备好了",
    title: "可以开始对决",
    description: "完成更多比较后，Tier List 会更稳定；标题或封面不理想时，可在作品卡片里编辑显示。",
    tone: "success" as const
  };
}

function hasChineseText(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function formatTagSuggestionMeta(tag: AnimeTagDictionaryEntry) {
  const aliases = tag.aliases.slice(0, 2).join(" / ");
  return aliases ? `${aliases} / ${tag.key}` : tag.key;
}

function validateCustomUploadFile(file: File) {
  if (!COVER_UPLOAD_ACCEPT.split(",").includes(file.type)) {
    return "只支持 jpg、png、webp、gif 图片，不支持 svg。";
  }

  if (file.size > COVER_UPLOAD_MAX_BYTES) {
    return "图片不能超过 5MB。";
  }

  return null;
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "未命名图片";
}

function makeDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function PoolAnimeCard({
  entry,
  isArchived,
  canManage,
  isMutating,
  onEdit,
  onRemove
}: {
  entry: PoolAnimeEntry;
  isArchived: boolean;
  canManage: boolean;
  isMutating: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const display = entry.display;
  const title = display.title;
  const coverUrl = getAnimeCoverUrl(
    { ...entry.anime, display, coverUrlOverride: entry.coverUrlOverride },
    { intent: "display" }
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-anime-border bg-slate-950/45 transition duration-anime hover:border-anime-cyan/25">
      <AnimeCover
        src={coverUrl}
        secondarySrc={entry.anime.imageSmallUrl ?? entry.anime.imageMediumUrl ?? entry.anime.imageLargeUrl}
        title={title}
        size="md"
        className="h-56 w-full rounded-none border-0 sm:h-64"
      />
      <div className="p-3">
        <div className="flex min-h-14 items-start gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-semibold text-white">{title}</h3>
          <AppBadge tone="muted">{display.sourceLabel}</AppBadge>
          {display.isOverridden ? <AppBadge tone="source">已修正</AppBadge> : null}
        </div>
        {display.subtitle ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{display.subtitle}</p> : null}
        <p className="mt-1 text-xs text-slate-500">
          #{entry.position}
          {display.animeType ? ` / ${display.animeType}` : ""}
        </p>
        {display.tags.length > 0 ? (
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
            {display.tags.slice(0, 4).map(labelAnimeTag).join(" / ")}
          </p>
        ) : null}
        {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!isArchived ? (
            <AppButton onClick={onEdit} disabled={isMutating} variant="quiet" size="sm">
              编辑显示
            </AppButton>
          ) : null}
          <AppButton onClick={onRemove} disabled={isArchived || isMutating} variant="quiet" size="sm">
            移除
          </AppButton>
        </div>
        ) : null}
      </div>
    </div>
  );
}

function BangumiResultCard({
  item,
  disabled,
  isAdding,
  actionLabel,
  onAdd
}: {
  item: BangumiSearchItem;
  disabled: boolean;
  isAdding: boolean;
  actionLabel: string;
  onAdd: () => void;
}) {
  const title = item.titleCn ?? item.title;
  const subtitle = item.titleCn ? item.title : null;
  const meta = [
    `Bangumi ID ${item.bangumiId}`,
    item.year !== null ? String(item.year) : null
  ].filter((value): value is string => value !== null);

  return (
    <div className="flex w-full min-w-0 gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
      <AnimeCover src={item.imageUrl} title={title} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 break-words text-sm font-semibold text-white">{title}</h3>
        {subtitle ? (
          <p className="mt-1 line-clamp-1 break-words text-xs text-slate-400">{subtitle}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-slate-400">
          {meta.map((itemMeta) => (
            <span key={itemMeta}>{itemMeta}</span>
          ))}
        </div>
        {item.summary ? (
          <p className="mt-2 line-clamp-3 break-words text-xs leading-5 text-slate-500">
            {item.summary}
          </p>
        ) : null}
        {item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-slate-300"
              >
                {labelAnimeTag(tag)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AppButton
            type="button"
            onClick={onAdd}
            disabled={disabled || isAdding}
            variant="primary"
            size="sm"
          >
            {actionLabel}
          </AppButton>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-slate-400 hover:text-cyan-200"
          >
            查看 Bangumi
          </a>
        </div>
      </div>
    </div>
  );
}

function PoolAnimeDisplayPanel({
  entry,
  isMutating,
  displayForm,
  setDisplayForm,
  onSave,
  onClear,
  onCancel,
  onUploaded
}: {
  entry: PoolAnimeEntry;
  isMutating: boolean;
  displayForm: DisplayOverrideForm;
  setDisplayForm: React.Dispatch<React.SetStateAction<DisplayOverrideForm>>;
  onSave: (event: FormEvent<HTMLFormElement>, coverUrlOverride?: string) => void | Promise<void>;
  onClear: () => void;
  onCancel: () => void;
  onUploaded: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const display = entry.display;
  const title = display.title;
  const coverUrl = getAnimeCoverUrl(
    { ...entry.anime, display, coverUrlOverride: entry.coverUrlOverride },
    { intent: "thumbnail" }
  );

  useEffect(() => {
    if (selectedCoverFile === null) {
      setCoverPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedCoverFile);
    setCoverPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedCoverFile]);

  useEffect(() => {
    setSelectedCoverFile(null);
    setCoverUploadError(null);
  }, [entry.animeId]);

  function handleCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    selectCoverFile(file);
  }

  function handleCoverDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    selectCoverFile(event.dataTransfer.files[0] ?? null);
  }

  function selectCoverFile(file: File | null) {
    setCoverUploadError(null);

    if (file === null) {
      setSelectedCoverFile(null);
      return;
    }

    if (!COVER_UPLOAD_ACCEPT.split(",").includes(file.type)) {
      setCoverUploadError("只支持 jpg、png、webp、gif 图片。");
      setSelectedCoverFile(null);
      return;
    }

    if (file.size > COVER_UPLOAD_MAX_BYTES) {
      setCoverUploadError("图片不能超过 5MB。");
      setSelectedCoverFile(null);
      return;
    }

    setSelectedCoverFile(file);
  }

  async function uploadSelectedCover() {
    if (selectedCoverFile === null) {
      return null;
    }

    setIsUploadingCover(true);
    setCoverUploadError(null);

    try {
      const result = await uploadPoolAnimeCover(entry.poolId, entry.animeId, selectedCoverFile);
      setDisplayForm((current) => ({ ...current, coverUrlOverride: result.coverUrl }));
      setSelectedCoverFile(null);
      if (fileInputRef.current !== null) {
        fileInputRef.current.value = "";
      }
      await onUploaded();
      return result.coverUrl;
    } catch (reason) {
      setCoverUploadError(reason instanceof Error ? reason.message : "上传封面失败");
      return null;
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function handleDisplaySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const uploadedCoverUrl =
      selectedCoverFile === null ? undefined : await uploadSelectedCover();

    if (selectedCoverFile !== null && uploadedCoverUrl === null) {
      return;
    }

    await onSave(event, uploadedCoverUrl ?? undefined);
  }

  return (
    <AppCard className="p-5" variant="focus">
      <div className="flex gap-3">
        <AnimeCover
          src={coverUrl}
          secondarySrc={entry.anime.imageSmallUrl ?? entry.anime.imageMediumUrl ?? entry.anime.imageLargeUrl}
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
              {display.tags.slice(0, 4).map(labelAnimeTag).join(" / ")}
            </p>
          ) : null}
        </div>
      </div>
        <form onSubmit={handleDisplaySubmit} className="mt-4 space-y-2 border-t border-anime-border pt-4">
          <p className="text-xs leading-5 text-cyan-100">
            这个修改只影响当前番组，不会改动全局动画库。
          </p>
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
          <p className="text-xs leading-5 text-slate-500">
            可以填写 http/https URL，也可以上传本地图片。外部封面加载失败时，页面会自动显示 fallback。
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={COVER_UPLOAD_ACCEPT}
            onChange={handleCoverFileChange}
            className="hidden"
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCoverDrop}
            className="rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.05] p-3 text-center text-xs leading-5 text-slate-300 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.08]"
          >
            {coverPreviewUrl ? (
              <div className="flex items-center gap-3 text-left">
                <div
                  aria-label="封面预览"
                  className="h-16 w-12 shrink-0 rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${coverPreviewUrl})` }}
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{selectedCoverFile?.name}</p>
                  <p className="text-slate-400">点击更换，或拖拽另一张图片到这里。</p>
                </div>
              </div>
            ) : (
              <>
                <p className="font-semibold text-cyan-100">拖拽图片到这里，或点击选择文件</p>
                <p className="mt-1 text-slate-500">支持 jpg/png/webp/gif，最大 5MB。</p>
              </>
            )}
          </div>
          {coverUploadError ? (
            <p className="text-xs leading-5 text-rose-200">{coverUploadError}</p>
          ) : null}
          {selectedCoverFile ? (
            <AppButton
              type="button"
              onClick={uploadSelectedCover}
              disabled={isMutating || isUploadingCover}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              {isUploadingCover ? "上传中..." : "上传并使用"}
            </AppButton>
          ) : null}
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
            <AppButton type="submit" disabled={isMutating || isUploadingCover} variant="primary" size="sm">
              {selectedCoverFile ? "上传并保存" : "保存"}
            </AppButton>
            <AppButton type="button" onClick={onClear} disabled={isMutating} variant="ghost" size="sm">
              清除修正
            </AppButton>
            <AppButton type="button" onClick={onCancel} disabled={isMutating} variant="ghost" size="sm">
              取消
            </AppButton>
          </div>
        </form>
    </AppCard>
  );
}
