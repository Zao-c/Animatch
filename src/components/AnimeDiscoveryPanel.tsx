"use client";

import { useEffect, useRef, useState } from "react";
import { AnimeCover } from "./AnimeCover";
import { AppButton } from "./ui/AppButton";
import { getAnimeCoverUrl, getAnimeSourceCoverCandidates } from "@/lib/anime-cover-url";
import { getAnimeDisplayTitle } from "@/lib/anime-display";
import { ANIME_TAG_DICTIONARY, labelAnimeTag, suggestAnimeTags, normalizeTagKey } from "@/lib/anime-tag-dictionary";
import { addAnimeToPool, bulkImportAnimeToPool, discoverAnime, searchBangumiAnime, type PublicAnime } from "@/lib/client-api";
import { bangumiSearchItemToAnime, DEFAULT_DISCOVERY_FILTERS, validateDiscoveryYears, type DiscoveryFilters } from "@/lib/anime-discovery";

const PAGE_SIZE = 12;
const selectionKey = (anime: PublicAnime) => anime.bgmId !== null ? `bgm:${anime.bgmId}` : anime.id;
const COMMON_TAGS = ANIME_TAG_DICTIONARY.filter((tag) => ["romance", "school", "comedy", "slice of life", "fantasy", "action", "mystery", "healing"].includes(tag.key));

export function AnimeDiscoveryPanel({ poolId, joinedAnimeIds, joinedBangumiIds, onAdded }: {
  poolId: string;
  joinedAnimeIds: Set<string>;
  joinedBangumiIds: Set<number>;
  onAdded: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const [applied, setApplied] = useState<DiscoveryFilters | null>(null);
  const [items, setItems] = useState<PublicAnime[]>([]);
  const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false), [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [adding, setAdding] = useState(false);
  const [errorKind, setErrorKind] = useState<"search" | "add">("search");
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, PublicAnime>>(new Map());
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  const additionLock = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);

  const isJoined = (anime: PublicAnime) => completed.has(selectionKey(anime)) || joinedAnimeIds.has(anime.id) || (anime.bgmId !== null && joinedBangumiIds.has(anime.bgmId));
  const pending = [...selected.values()].filter((anime) => !isJoined(anime));
  const changed = applied !== null && JSON.stringify(draft) !== JSON.stringify(applied);
  const suggestions = draft.q.trim() ? suggestAnimeTags(draft.q, 4).filter((tag) => !draft.tags.includes(tag.key)) : [];

  function update<K extends keyof DiscoveryFilters>(key: K, value: DiscoveryFilters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function toggleTag(key: string) {
    setDraft((current) => ({ ...current, tags: current.tags.includes(key) ? current.tags.filter((tag) => tag !== key) : [...current.tags, key].slice(0, 5) }));
  }
  async function search(filters: DiscoveryFilters, nextPage = 0) {
    setErrorKind("search");
    const invalid = validateDiscoveryYears(filters);
    if (invalid) { setError(invalid); return; }
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    const version = ++generation.current;
    setBusy(true); setError(null); setNotice(null);
    const snapshot = { ...filters, q: filters.q.trim(), tags: [...filters.tags] };
    try {
      const params = {
        yearFrom: filters.yearFrom ? Number(filters.yearFrom) : undefined,
        yearTo: filters.yearTo ? Number(filters.yearTo) : undefined,
        type: filters.type || undefined, tags: filters.tags, sort: filters.sort, offset: nextPage * PAGE_SIZE
      };
      let results: PublicAnime[], more: boolean, count: number | null;
      if (filters.source === "bangumi") {
        const response = await searchBangumiAnime(snapshot.q, PAGE_SIZE, { ...params, signal: request.signal });
        results = response.items.map(bangumiSearchItemToAnime);
        more = response.hasMore ?? response.items.length === PAGE_SIZE; count = null;
      } else {
        const response = await discoverAnime({ ...params, q: snapshot.q || undefined, limit: PAGE_SIZE }, request.signal);
        results = response.items; count = response.total; more = (nextPage + 1) * PAGE_SIZE < response.total;
      }
      if (version !== generation.current || request.signal.aborted) return;
      setItems([...new Map(results.map((anime) => [anime.id, anime])).values()]);
      setApplied(snapshot); setPage(nextPage); setHasMore(more); setTotal(count);
      requestAnimationFrame(() => {
        if (version === generation.current) resultRef.current?.scrollIntoView({ block: "start" });
      });
    } catch (reason) {
      if (version === generation.current && !request.signal.aborted) setError(reason instanceof Error ? reason.message : "查询失败，请重试。");
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  function toggle(anime: PublicAnime) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(selectionKey(anime))) next.delete(selectionKey(anime)); else next.set(selectionKey(anime), anime);
      return next;
    });
  }
  async function add(animes: PublicAnime[]) {
    if (additionLock.current || !animes.length) return;
    additionLock.current = true; setAdding(true); setError(null); setNotice(null); setErrorKind("add");
    let added = 0;
    const failed: string[] = [], successful = new Set<string>();
    try {
      // Sequential mutations keep the small server responsive and preserve partial success.
      for (const anime of animes) {
        try {
          if (anime.id.startsWith("bgm:") && anime.bgmId !== null) {
            const result = await bulkImportAnimeToPool(poolId, String(anime.bgmId));
            if (result.failed.length) throw new Error(result.failed[0].reason || "添加失败");
          } else await addAnimeToPool(poolId, { animeId: anime.id });
          added++; successful.add(selectionKey(anime));
          setCompleted((current) => new Set([...current, selectionKey(anime)]));
        } catch (reason) { failed.push(`${getAnimeDisplayTitle(anime)}：${reason instanceof Error ? reason.message : "添加失败"}`); }
      }
      setSelected((current) => new Map([...current].filter(([id]) => !successful.has(id))));
      if (added) {
        setNotice(`已加入 ${added} 部作品。`);
        try { await onAdded(); } catch { failed.push("作品已加入，作品墙刷新失败，请刷新页面。"); }
      }
      if (failed.length) setError(failed.join("；"));
    } finally { additionLock.current = false; setAdding(false); }
  }

  return <div className="mt-4 min-w-0 space-y-4" data-testid="anime-discovery">
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="作品数据来源">
      {([["bangumi", "Bangumi 在线"], ["local", "本地动画库"]] as const).map(([source, label]) => <button key={source} type="button" aria-pressed={draft.source === source} onClick={() => {
        controller.current?.abort(); generation.current++; setBusy(false); setError(null);
        const next = { ...draft, source, sort: source === "bangumi" ? "match" : "title" };
        setDraft(next); setItems([]); setApplied(null); setHasMore(false); setTotal(null); setPage(0);
      }} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${draft.source === source ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-slate-400 hover:text-white"}`}>{label}</button>)}
    </div>
    <form onSubmit={(event) => { event.preventDefault(); void search(draft); }} className="space-y-3">
      <label className="block text-xs text-slate-400">作品名称{draft.source === "bangumi" ? " / Bangumi 链接或 ID" : " / 别名"}
        <div className="mt-1 flex gap-2"><input type="search" aria-label="搜索作品" maxLength={200} value={draft.q} onChange={(event) => update("q", event.target.value)} placeholder={draft.source === "bangumi" ? "中文名、原名或条目链接" : "搜索本地已收录的作品"} className="anime-field min-w-0 flex-1" /><AppButton type="submit" variant="primary">{busy ? "重新查询" : "搜索"}</AppButton></div>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-400">作品形式<select aria-label="作品形式" value={draft.type} onChange={(event) => update("type", event.target.value)} className="anime-field mt-1"><option value="">全部形式</option>{["TV", "MOVIE", "OVA", "ONA", "SPECIAL"].map((type) => <option key={type} value={type}>{type === "MOVIE" ? "动画电影" : type === "SPECIAL" ? "特别篇" : type}</option>)}</select></label>
        <label className="text-xs text-slate-400">排序<select aria-label="作品排序" value={draft.sort} onChange={(event) => update("sort", event.target.value)} className="anime-field mt-1">{draft.source === "bangumi" ? <option value="match">匹配度</option> : <><option value="title">按标题</option><option value="year">按年份</option></>}<option value="score">按评分</option><option value="rank">按排名</option></select></label>
      </div>
      <details className="rounded-xl border border-white/10 p-3">
        <summary className="cursor-pointer text-sm text-slate-300">年份与题材{draft.tags.length ? ` · ${draft.tags.length} 个标签` : ""}{draft.yearFrom || draft.yearTo ? " · 已选年份" : ""}</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">{([ ["yearFrom", "开始年份"], ["yearTo", "结束年份"] ] as const).map(([key, label]) => <label key={key} className="text-xs text-slate-400">{label}<input aria-label={label} type="number" min={1900} max={2100} value={draft[key]} onChange={(event) => update(key, event.target.value)} placeholder="不限" className="anime-field mt-1" /></label>)}</div>
        <div className="mt-3 flex flex-wrap gap-2">{COMMON_TAGS.map((tag) => <button key={tag.key} type="button" aria-pressed={draft.tags.includes(tag.key)} onClick={() => toggleTag(tag.key)} className={`min-h-9 rounded-full border px-3 text-xs ${draft.tags.includes(tag.key) ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-slate-400"}`}>{tag.label}</button>)}</div>
        <label className="mt-3 block text-xs text-slate-400">更多标签<select aria-label="添加题材标签" value="" onChange={(event) => toggleTag(event.target.value)} className="anime-field mt-1"><option value="" disabled>选择题材标签 · 最多 5 个</option>{ANIME_TAG_DICTIONARY.filter((tag) => !draft.tags.includes(tag.key)).map((tag) => <option key={tag.key} value={tag.key}>{tag.label}</option>)}</select></label>
        <p className="mt-2 text-xs text-slate-500">多个标签同时满足；留空名称可以直接浏览。</p>
      </details>
      {suggestions.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>也可按题材找：</span>{suggestions.map((tag) => <button type="button" key={tag.key} onClick={() => {
        const exact = [tag.key, tag.label, ...tag.aliases].map(normalizeTagKey).includes(normalizeTagKey(draft.q));
        setDraft((current) => ({ ...current, q: exact ? "" : current.q, tags: [...current.tags, tag.key].slice(0, 5) }));
      }} className="min-h-9 rounded-full border border-cyan-300/25 px-3 text-cyan-100">{tag.label}</button>)}</div>}
      {(draft.tags.length > 0 || draft.yearFrom || draft.yearTo || draft.type) && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">{draft.tags.map((tag) => <button type="button" onClick={() => toggleTag(tag)} className="min-h-9 rounded-full border border-cyan-300/25 px-3 text-cyan-100" key={tag}>{labelAnimeTag(tag)} ×</button>)}<button type="button" className="min-h-9 px-2" onClick={() => setDraft({ ...DEFAULT_DISCOVERY_FILTERS, source: draft.source, q: draft.q, sort: draft.source === "local" ? "title" : "match" })}>清空筛选</button></div>}
      <div className="flex flex-wrap items-center gap-2"><AppButton type="submit" size="sm" variant="ghost">应用筛选</AppButton><AppButton type="button" size="sm" variant="quiet" onClick={() => { const next = { ...draft, q: "", yearFrom: String(new Date().getFullYear()), yearTo: String(new Date().getFullYear()) }; setDraft(next); void search(next); }}>今年新番</AppButton></div>
    </form>
    {error && <div role="alert" className="rounded-xl border border-rose-300/25 bg-rose-300/5 p-3 text-sm text-rose-200"><p>{error}</p>{errorKind === "search" && <AppButton type="button" size="sm" variant="quiet" onClick={() => void search(draft)}>重试查询</AppButton>}</div>}
    {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
    <div ref={resultRef} aria-busy={busy} className="scroll-mt-28 space-y-3">
      <div role="status" className="text-xs text-slate-400">{busy ? "正在查询作品…" : applied ? `${applied.source === "bangumi" ? "Bangumi 在线" : "本地动画库"} · 第 ${page + 1} 页 · ${items.length} 部${total !== null ? ` / 共 ${total} 部` : ""}` : "输入名称或选择筛选条件，查找想加入的作品。"}{changed && <span className="block mt-1 text-amber-200">筛选已修改，点击搜索或应用筛选后生效。</span>}</div>
      {!busy && applied && !error && items.length === 0 && <div className="rounded-xl border border-white/10 p-4 text-sm text-slate-400"><p>没有找到匹配作品，试试减少标签或换个名称。</p><AppButton type="button" variant="quiet" size="sm" onClick={() => { const next = { ...draft, source: draft.source === "bangumi" ? "local" as const : "bangumi" as const, sort: draft.source === "bangumi" ? "title" : "match" }; setDraft(next); void search(next); }}>换到{draft.source === "bangumi" ? "本地动画库" : "Bangumi 在线"}查找</AppButton></div>}
      {items.length > 0 && <div className="flex justify-end"><button type="button" disabled={adding || busy} className="min-h-9 text-xs text-cyan-200" onClick={() => setSelected((current) => new Map([...current, ...items.filter((anime) => !isJoined(anime)).map((anime) => [selectionKey(anime), anime] as const)]))}>选中本页</button></div>}
      <div className={`grid grid-cols-2 gap-3 ${busy ? "pointer-events-none opacity-50" : ""}`}>
        {items.map((anime) => {
          const title = getAnimeDisplayTitle(anime), joined = isJoined(anime), checked = selected.has(selectionKey(anime));
          return <article key={anime.id} data-anime-result={anime.id} className={`min-w-0 overflow-hidden rounded-xl border bg-slate-950/40 ${checked ? "border-cyan-300/60" : "border-white/10"}`}>
            <div className="flex justify-center bg-slate-950/50 p-2"><AnimeCover animeId={anime.id} src={getAnimeCoverUrl(anime)} fallbackSrcs={getAnimeSourceCoverCandidates(anime)} title={title} size="md" fit="contain" /></div>
            <div className="space-y-2 p-3"><h3 title={title} className="line-clamp-2 min-h-10 text-sm font-semibold">{title}</h3><p className="truncate text-xs text-slate-400">{[anime.year, anime.animeType, anime.bangumiScore != null ? `评分 ${anime.bangumiScore}` : null].filter(Boolean).join(" · ") || "暂无年份与评分"}</p>
              <div className="flex flex-wrap items-center justify-between gap-1"><label className={`flex min-h-11 items-center gap-2 text-xs ${joined || adding ? "text-slate-500" : "cursor-pointer text-slate-300"}`}><input type="checkbox" aria-label={`选择 ${title}`} checked={checked && !joined} disabled={joined || adding || busy} onChange={() => toggle(anime)} />{joined ? "已加入" : "选中"}</label>{anime.bgmId && <a href={`https://bgm.tv/subject/${anime.bgmId}`} target="_blank" rel="noreferrer" className="py-3 text-xs text-slate-400 hover:text-cyan-200" aria-label={`查看 ${title} 的 Bangumi 资料`}>资料 ↗</a>}</div>
              <AppButton type="button" variant={joined ? "quiet" : "ghost"} size="sm" className="w-full" disabled={joined || adding || busy} onClick={() => void add([anime])}>{joined ? "已加入番组" : "加入番组"}</AppButton>
            </div>
          </article>;
        })}
      </div>
      {applied && (page > 0 || hasMore) && <nav aria-label="查找作品分页" className="flex items-center justify-between gap-2"><AppButton type="button" size="sm" variant="ghost" disabled={busy || page === 0} onClick={() => void search(applied, page - 1)}>上一页</AppButton><span className="text-xs text-slate-400">第 {page + 1} 页</span><AppButton type="button" size="sm" variant="ghost" disabled={busy || !hasMore} onClick={() => void search(applied, page + 1)}>下一页</AppButton></nav>}
    </div>
    {pending.length > 0 && <div className="sticky bottom-0 z-10 space-y-2 rounded-xl border border-cyan-300/20 bg-slate-950/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-300">已选 {pending.length} 部（跨页保留）</span><button type="button" disabled={adding} className="min-h-9 text-slate-400" onClick={() => setSelected(new Map())}>清空已选</button></div>
      <AppButton type="button" variant="primary" className="w-full" disabled={adding} onClick={() => void add(pending)}>{adding ? "正在加入，请稍候…" : `加入选中作品（${pending.length}）`}</AppButton>
    </div>}
  </div>;
}
