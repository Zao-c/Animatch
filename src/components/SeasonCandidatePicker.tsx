"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPool, getSeasonDetail, type PoolAnimeEntry } from "@/lib/client-api";
import { getAnimeCoverUrl, getAnimeSourceCoverCandidates } from "@/lib/anime-cover-url";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { AnimeCover } from "./AnimeCover";
import { AppButton } from "./ui/AppButton";

export function SeasonCandidatePicker({ poolId, seasonId, ownerId, onSave, onClose }: {
  poolId: string; seasonId: string; ownerId: string;
  onSave: (included: string[], previousHidden: string[], poolIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PoolAnimeEntry[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [baseIncluded, setBaseIncluded] = useState<Set<string>>(new Set());
  const [baseHidden, setBaseHidden] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const lock = useRef(false);
  const generation = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const dirty = included.size !== baseIncluded.size || [...included].some((id) => !baseIncluded.has(id));
  useUnsavedChanges(dirty);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const [pool, season] = await Promise.all([getPool(poolId), getSeasonDetail(poolId, seasonId)]);
      if (request !== generation.current) return;
      if (season.viewerId !== ownerId) throw new Error("登录账号已变化，请关闭面板并重新加载赛季。");
      const hidden = season.currentUserState?.hiddenAnimeIds ?? [];
      const selected = new Set(pool.anime.filter((item) => !hidden.includes(item.animeId)).map((item) => item.animeId));
      setItems(pool.anime);
      setBaseHidden(hidden);
      setIncluded(selected);
      setBaseIncluded(selected);
      setPage(0);
    } catch (reason) { if (request === generation.current) setError(reason instanceof Error ? reason.message : "作品清单加载失败。"); }
    finally { if (request === generation.current) setLoading(false); }
  }, [poolId, seasonId, ownerId]);

  useEffect(() => {
    const version = generation;
    void load();
    return () => { version.current++; };
  }, [load]);

  useEffect(() => { if (!loading) searchRef.current?.focus(); }, [loading]);

  const close = useCallback(() => {
    if (lock.current) return;
    if (dirty && !window.confirm("还有未应用的作品选择，关闭并放弃这次调整？")) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [close]);

  const search = query.trim().toLocaleLowerCase();
  const filtered = items.filter((item) => [item.display.title, item.anime.title, item.anime.titleCn, ...item.anime.aliases].some((title) => title?.toLocaleLowerCase().includes(search)));
  const maxPage = Math.max(0, Math.ceil(filtered.length / 24) - 1);
  const currentPage = Math.min(page, maxPage);
  const visible = filtered.slice(currentPage * 24, (currentPage + 1) * 24);

  function toggle(id: string) {
    if (lock.current) return;
    setIncluded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function save() {
    if (lock.current || loading || included.size < 2) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave([...included], baseHidden, items.map((item) => item.animeId));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试；选择已保留。"); }
    finally { lock.current = false; setSaving(false); }
  }

  return <section aria-labelledby="season-candidates-title" className="my-3 rounded-2xl border border-amber-300/30 bg-slate-950 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="season-candidates-title" className="font-bold">选择熟悉的作品</h2><AppButton variant="ghost" size="sm" disabled={saving} onClick={close}>关闭</AppButton></div>
    <p className="my-2 text-sm text-slate-400">勾选参与本赛季对决的作品，未勾选的暂时隐藏。可以随时回来恢复，不消耗票数，也不会删除历史投票。</p>
    {loading ? <p role="status" className="py-6 text-sm text-slate-300">正在加载作品清单…</p> : <>
      {error && <div role="alert" className="my-2 text-sm text-amber-200"><p>{error}</p><AppButton variant="quiet" size="sm" disabled={saving} onClick={() => { if (!dirty || window.confirm("重新加载会放弃当前未应用的选择，继续？")) void load(); }}>重新加载清单</AppButton></div>}
      <fieldset disabled={saving} className="min-w-0">
        <label className="block text-xs text-slate-400">搜索作品<input ref={searchRef} className="anime-field my-2 w-full" value={query} placeholder="按名称或别名搜索" onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><span>已选 {included.size} / {items.length} 部</span><AppButton variant="quiet" size="sm" onClick={() => setIncluded(new Set(items.map((item) => item.animeId)))}>选择全部作品</AppButton><AppButton variant="quiet" size="sm" onClick={() => setIncluded(new Set())}>清空后重新选</AppButton><AppButton variant="quiet" size="sm" disabled={!visible.length} onClick={() => setIncluded((current) => new Set([...current, ...visible.map((item) => item.animeId)]))}>选择本页 {visible.length} 部</AppButton><AppButton variant="quiet" size="sm" disabled={!visible.length} onClick={() => { const ids = new Set(visible.map((item) => item.animeId)); setIncluded((current) => new Set([...current].filter((id) => !ids.has(id)))); }}>取消本页</AppButton></div>
        <div className="grid max-h-[45dvh] grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map((item) => <label key={item.animeId} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 ${included.has(item.animeId) ? "border-amber-200 bg-amber-200/5" : "border-white/10"}`}>
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-amber-300" checked={included.has(item.animeId)} onChange={() => toggle(item.animeId)} aria-label={`让 ${item.display.title} 参与对决`} />
            <div className="min-w-0"><AnimeCover title={item.display.title} src={getAnimeCoverUrl(item, { intent: "display" })} fallbackSrcs={getAnimeSourceCoverCandidates(item)} size="sm" /><span className="mt-1 line-clamp-2 text-xs" title={item.display.title}>{item.display.title}</span></div>
          </label>)}
          {!visible.length && <p className="col-span-full py-5 text-sm text-slate-400">{search ? "没有匹配的作品，试试其他名称。" : "番组中暂无作品。"}</p>}
        </div>
        {maxPage > 0 && <div className="mt-2 flex items-center justify-between text-xs"><AppButton size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</AppButton><span>{currentPage + 1} / {maxPage + 1} · 其他页的选择保留</span><AppButton size="sm" variant="ghost" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}>下一页</AppButton></div>}
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center gap-3"><AppButton disabled={saving || items.length < 2 || included.size < 2} onClick={() => void save()}>{saving ? "正在保存…" : `应用 ${included.size} 部作品并继续`}</AppButton><span className="text-xs text-slate-400">{included.size < 2 ? "至少选择 2 部作品。" : `将隐藏 ${items.length - included.size} 部，之后可恢复。`}</span></div>
    </>}
  </section>;
}
