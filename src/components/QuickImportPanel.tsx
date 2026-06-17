"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAnimeCoverUrl } from "@/lib/anime-cover-url";
import { getAnimeDisplayTitle } from "@/lib/anime-display";
import {
  addQuickImportToPool,
  createPoolFromQuickImport,
  previewQuickImport,
  type QuickImportCandidate,
  type QuickImportPreviewResult,
} from "@/lib/client-api";
import { QUICK_IMPORT_PRESETS } from "@/lib/import/quick-import-presets";
import type { QuickImportParams } from "@/lib/import/quick-pool-builder";

const SOURCES: { key: string; label: string }[] = [
  { key: "MIXED", label: "混合" },
  { key: "BANGUMI", label: "Bangumi" },
  { key: "MANAMI", label: "Manami" },
];

const MODES: { key: string; label: string }[] = [
  { key: "YEAR", label: "年份新番" },
  { key: "TAG", label: "标签筛选" },
  { key: "TOP", label: "Top 榜" },
  { key: "USER_COLLECTION", label: "用户收藏" },
];

const TYPES: { key: string; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "TV", label: "TV" },
  { key: "MOVIE", label: "MOVIE" },
  { key: "OVA", label: "OVA" },
];

const SORTS: { key: string; label: string }[] = [
  { key: "rank", label: "排名" },
  { key: "score", label: "评分" },
  { key: "year", label: "年份" },
  { key: "title", label: "标题" },
];

const LIMITS = [20, 30, 50, 100];

const COMMON_TAGS = [
  { key: "romance", label: "恋爱" },
  { key: "school", label: "校园" },
  { key: "isekai", label: "异世界" },
  { key: "action", label: "动作" },
  { key: "hot blooded", label: "热血" },
  { key: "comedy", label: "搞笑" },
  { key: "slice of life", label: "日常" },
  { key: "fantasy", label: "奇幻" },
  { key: "sci-fi", label: "科幻" },
  { key: "mystery", label: "悬疑" },
  { key: "horror", label: "恐怖" },
  { key: "healing", label: "治愈" },
  { key: "mecha", label: "机战" },
  { key: "music", label: "音乐" },
  { key: "sports", label: "运动" },
];

function makeCandidateCoverUrl(candidate: QuickImportCandidate): string | null {
  const fakeAnime = {
    id: candidate.animeId,
    imageUrl: candidate.imageUrl,
    imageLargeUrl: candidate.imageLargeUrl,
    imageMediumUrl: candidate.imageMediumUrl,
    imageSmallUrl: candidate.thumbnailUrl,
    thumbnailUrl: candidate.thumbnailUrl,
    source: candidate.source,
    coverUrl: null,
    coverUrlOverride: null,
  } as Parameters<typeof getAnimeCoverUrl>[0];
  return getAnimeCoverUrl(fakeAnime, { intent: "display" });
}

function makeAnimeForCover(candidate: QuickImportCandidate) {
  return {
    id: candidate.animeId,
    imageUrl: candidate.imageUrl,
    imageLargeUrl: candidate.imageLargeUrl,
    imageMediumUrl: candidate.imageMediumUrl,
    imageSmallUrl: candidate.thumbnailUrl,
    thumbnailUrl: candidate.thumbnailUrl,
    source: candidate.source,
    coverUrl: null,
    coverUrlOverride: null,
  } as Parameters<typeof getAnimeCoverUrl>[0];
}

export function QuickImportPanel({
  poolId,
  onAdded,
}: {
  poolId?: string;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const [source, setSource] = useState<string>("MIXED");
  const [mode, setMode] = useState<string>("YEAR");
  const [year, setYear] = useState<string>("2026");
  const [type, setType] = useState<string>("ALL");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(50);
  const [sort, setSort] = useState<string>("rank");
  const [poolName, setPoolName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [preview, setPreview] = useState<QuickImportPreviewResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const buildParams = useCallback((): QuickImportParams => {
    const p: QuickImportParams = {
      source: source as QuickImportParams["source"],
      mode: mode as QuickImportParams["mode"],
      limit,
      sort,
    };
    if (year && year.trim()) p.year = parseInt(year, 10);
    if (type && type !== "ALL") p.type = type;
    if (selectedTags.length > 0) p.tags = selectedTags;
    return p;
  }, [source, mode, year, type, selectedTags, limit, sort]);

  async function handlePreview() {
    setError(null);
    setPreview(null);
    setIsLoading(true);
    try {
      const result = await previewQuickImport({ params: buildParams(), poolId });
      setPreview(result);
      setSelectedIds(new Set(result.candidates.filter((c) => !c.alreadyInPool).map((c) => c.animeId)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "预览失败");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleCandidate(animeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(animeId)) next.delete(animeId);
      else next.add(animeId);
      return next;
    });
  }

  function selectAll() {
    if (!preview) return;
    setSelectedIds(new Set(preview.candidates.filter((c) => !c.alreadyInPool).map((c) => c.animeId)));
  }

  function deselectExisting() {
    if (!preview) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of preview.candidates) {
        if (c.alreadyInPool) next.delete(c.animeId);
      }
      return next;
    });
  }

  async function handleCreatePool() {
    if (!poolName.trim()) {
      setError("请输入番组名");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const result = await createPoolFromQuickImport({
        poolName: poolName.trim(),
        description: description.trim() || undefined,
        visibility,
        params: buildParams(),
      });
      router.push(`/pools/${result.poolId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建番组失败");
      setIsCreating(false);
    }
  }

  async function handleAddToPool() {
    if (!poolId) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError("没有选中任何作品");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const result = await addQuickImportToPool(poolId, ids);
      setResultMessage(`成功添加 ${result.addedCount} 部，跳过 ${result.skippedCount} 部`);
      setPreview(null);
      setSelectedIds(new Set());
      onAdded?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "添加失败");
    } finally {
      setIsCreating(false);
    }
  }

  function applyPreset(preset: (typeof QUICK_IMPORT_PRESETS)[number]) {
    const p = preset.params;
    setSource(p.source);
    setMode(p.mode);
    if (p.year) setYear(String(p.year));
    if (p.type) setType(p.type);
    if (p.tags) setSelectedTags(p.tags);
    if (p.limit) setLimit(p.limit);
    if (p.sort) setSort(p.sort);
    setPreview(null);
    setSelectedIds(new Set());
  }

  const canCreate = !poolId && poolName.trim().length > 0;
  const canAdd = !!poolId && selectedIds.size > 0;

  return (
    <div className="space-y-5">
      <AppCard className="p-5">
        <SectionHeader eyebrow="Quick import" title={poolId ? "批量添加作品" : "快速生成番组"} />

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_IMPORT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="min-h-9 rounded-full border border-anime-purple/25 bg-anime-purple/10 px-3 text-xs font-semibold text-purple-100 transition hover:border-anime-pink/40 hover:bg-anime-pink/12"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-slate-400">来源</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSource(s.key)}
                  className={`min-h-8 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    source === s.key
                      ? "border-anime-cyan/50 bg-anime-cyan/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-400">模式</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={`min-h-8 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    mode === m.key
                      ? "border-anime-pink/50 bg-anime-pink/12 text-pink-100"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {mode === "YEAR" || mode === "TOP" ? (
            <label className="block">
              <span className="text-xs font-semibold text-slate-400">年份</span>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="anime-field mt-1.5"
                placeholder="2026"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-semibold text-slate-400">类型</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={`min-h-7 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                    type === t.key
                      ? "border-amber-400/50 bg-amber-400/12 text-amber-100"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-400">数量</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {LIMITS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLimit(l)}
                  className={`min-h-7 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                    limit === l
                      ? "border-amber-400/50 bg-amber-400/12 text-amber-100"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </label>
        </div>

        {mode === "TAG" || mode === "USER_COLLECTION" ? (
          <div className="mt-3">
            <span className="text-xs font-semibold text-slate-400">标签</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COMMON_TAGS.map((tag) => {
                const active = selectedTags.includes(tag.key);
                return (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() => toggleTag(tag.key)}
                    className={`min-h-7 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                      active
                        ? "border-emerald-400/50 bg-emerald-400/12 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <span className="text-xs font-semibold text-slate-400">排序</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`min-h-7 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                  sort === s.key
                    ? "border-amber-400/50 bg-amber-400/12 text-amber-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {!poolId ? (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-400">番组名</span>
              <input
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                className="anime-field mt-1.5"
                placeholder="例如：2026 TV 新番 Top 50"
                maxLength={80}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-400">描述</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="anime-field mt-1.5"
                placeholder="可选"
                maxLength={500}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visibility === "PUBLIC"}
                onChange={(e) => setVisibility(e.target.checked ? "PUBLIC" : "PRIVATE")}
                className="h-4 w-4 accent-cyan-400"
              />
              <span className="text-sm text-slate-300">公开展示</span>
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <AppButton type="button" onClick={handlePreview} disabled={isLoading} variant="primary">
            {isLoading ? "加载中..." : "预览"}
          </AppButton>
          {!poolId ? (
            <AppButton type="button" onClick={handleCreatePool} disabled={!canCreate || isCreating} variant="secondary">
              {isCreating ? "创建中..." : "创建番组"}
            </AppButton>
          ) : (
            <AppButton type="button" onClick={handleAddToPool} disabled={!canAdd || isCreating} variant="secondary">
              {isCreating ? "添加中..." : `添加选中 (${selectedIds.size})`}
            </AppButton>
          )}
        </div>
      </AppCard>

      {error ? <ErrorAlert message={error} /> : null}
      {resultMessage ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/8 p-3 text-sm text-emerald-100">
          {resultMessage}
        </div>
      ) : null}

      {preview ? (
        <AppCard className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AppBadge tone="source">{preview.total} 部</AppBadge>
              {preview.warnings.length > 0 ? (
                <span className="text-xs text-amber-300">{preview.warnings[0]}</span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-semibold text-slate-400 transition hover:text-white"
              >
                全选
              </button>
              {poolId ? (
                <button
                  type="button"
                  onClick={deselectExisting}
                  className="text-xs font-semibold text-slate-400 transition hover:text-white"
                >
                  取消已存在
                </button>
              ) : null}
            </div>
          </div>

          {preview.candidates.length === 0 ? (
            <p className="text-sm text-slate-400">没有找到符合条件的作品。</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {preview.candidates.map((candidate) => {
                const selected = selectedIds.has(candidate.animeId);
                const covUrl = makeCandidateCoverUrl(candidate);
                return (
                  <button
                    key={candidate.animeId}
                    type="button"
                    onClick={() => toggleCandidate(candidate.animeId)}
                    disabled={candidate.alreadyInPool}
                    className={`group relative overflow-hidden rounded-xl border text-left transition ${
                      selected
                        ? "border-anime-cyan/70 ring-1 ring-anime-cyan/40"
                        : candidate.alreadyInPool
                          ? "border-white/10 bg-white/[0.02] opacity-50"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    <div className="aspect-[2/3] w-full">
                      <AnimeCover
                        animeId={candidate.animeId}
                        src={covUrl}
                        title={candidate.titleCn ?? candidate.title}
                        size="lg"
                        fit="cover"
                      />
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[11px] font-semibold text-slate-200 group-hover:text-white">
                        {getAnimeDisplayTitle({
                          title: candidate.title,
                          titleCn: candidate.titleCn,
                          titleJa: null,
                          titleEn: null,
                        } as Parameters<typeof getAnimeDisplayTitle>[0])}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {candidate.year ? (
                          <span className="text-[10px] text-slate-500">{candidate.year}</span>
                        ) : null}
                        {candidate.animeType ? (
                          <span className="text-[10px] text-slate-500">{candidate.animeType}</span>
                        ) : null}
                        {candidate.alreadyInPool ? (
                          <span className="text-[10px] font-semibold text-amber-400">已存在</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1">
                        {candidate.score ? (
                          <span className="text-[10px] text-slate-500">★{candidate.score?.toFixed(1)}</span>
                        ) : null}
                        {candidate.rank ? (
                          <span className="text-[10px] text-slate-500">#{candidate.rank}</span>
                        ) : null}
                      </div>
                    </div>
                    {selected ? (
                      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-anime-cyan text-[10px] font-black text-slate-900">
                        ✓
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </AppCard>
      ) : null}
    </div>
  );
}
