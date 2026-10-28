"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimeCover } from "./AnimeCover";
import { TierShareCard } from "./TierShareView";
import { AppButton, appButtonClasses } from "./ui/AppButton";
import { buildManualBoardShare, moveBoardItem, validateManualBoard, type ManualBoardData } from "@/lib/manual-board";
import { getAnimeSourceCoverCandidates } from "@/lib/anime-cover-url";
import { COLOR_PALETTE, DEFAULT_TIER_CONFIG, TIER_TEMPLATES } from "@/lib/tier-config";
import { copyToClipboard } from "@/lib/clipboard";
import { exportShareCardAsPng } from "@/lib/share-export";
import type { PublicTierShare, TierShareSnapshotItem } from "@/lib/client-api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { useRecoverableDraft } from "@/lib/use-recoverable-draft";
import { DraftRecoveryNotice } from "./DraftRecoveryNotice";

export function ManualTierBoard({ initial, ownerId }: { initial: ManualBoardData; ownerId: string }) {
  const [board, setBoard] = useState(initial);
  const [savedContent, setSavedContent] = useState(() => JSON.stringify({ title: initial.title.trim(), layout: initial.layout }));
  const dirty = JSON.stringify({ title: board.title.trim(), layout: board.layout }) !== savedContent;
  const recovery = useRecoverableDraft(`animatch:draft:manual:${ownerId}:${initial.pool.id}`, { title: board.title, layout: board.layout }, dirty, String(board.revision));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("直接拖动封面到档位，也可以点选作品后点击档位。");
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selected = selectedIds.length === 1 ? selectedIds[0] : null;
  const dragIds = useRef<string[]>([]);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<ManualBoardData["layout"][]>([]);
  const [exportShare, setExportShare] = useState<PublicTierShare | null>(null);
  const [showItemTitles, setShowItemTitles] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const rowEditor = useRef<HTMLDetailsElement>(null);
  const byId = useMemo(() => new Map(board.items.map((item) => [item.animeId, item])), [board.items]);
  const ranked = useMemo(() => new Set(Object.values(board.layout.tiers).flat()), [board.layout]);
  const unranked = board.items.filter((item) => !ranked.has(item.animeId));
  const search = query.trim().toLocaleLowerCase();
  const filtered = search ? board.items.filter((item) => item.title.toLocaleLowerCase().includes(search)) : unranked;
  const maxPage = Math.max(0, Math.ceil(filtered.length / 24) - 1);
  const currentPage = Math.min(page, maxPage);
  const selectedRow = board.layout.rows.find((row) => board.layout.tiers[row.id]?.includes(selected ?? ""));
  useUnsavedChanges(dirty);
  const editable = !busy && recovery.ready && !recovery.pending;

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelectedIds([]); endDrag(); } };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);

  function changeLayout(layout: ManualBoardData["layout"]) {
    if (busy || JSON.stringify(layout) === JSON.stringify(board.layout)) return;
    setHistory((current) => [...current.slice(-29), board.layout]);
    setBoard((current) => ({ ...current, layout }));
    setError(null);
  }

  function move(id: string, row?: string, before?: string) {
    moveItems([id], row, before);
  }

  function moveItems(ids: string[], row?: string, before?: string) {
    if (!editable || !ids.length || ids.some((id) => !byId.has(id)) || (before && ids.includes(before))) return;
    const layout = ids.reduce((current, id) => moveBoardItem(current, id, row, before), board.layout);
    changeLayout(layout);
    setStatus(`${ids.length === 1 ? byId.get(ids[0])!.title : `${ids.length} 部作品`} 已移至${row ? board.layout.rows.find((entry) => entry.id === row)?.label : "待排作品"}，可撤销。`);
    setSelectedIds([]);
  }

  function endDrag() {
    dragIds.current = [];
    setDragging(false);
    setDragTarget(null);
  }

  function dropProps(row?: string, before?: string) {
    return {
      onDragOver: (event: React.DragEvent<HTMLElement>) => {
        if (!editable || !dragIds.current.length) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setDragTarget(row ?? "");
      },
      onDrop: (event: React.DragEvent<HTMLElement>) => {
        if (!dragIds.current.length) return;
        event.preventDefault();
        event.stopPropagation();
        moveItems(dragIds.current, row, before);
        endDrag();
      }
    };
  }

  function addRow() {
    if (busy || board.layout.rows.length >= 7) return;
    let number = 1;
    while (board.layout.rows.some((row) => row.id === `custom-${number}`)) number++;
    const id = `custom-${number}`;
    const rows = [...board.layout.rows, { id, label: `新档位 ${number}`, color: COLOR_PALETTE[board.layout.rows.length % COLOR_PALETTE.length], order: board.layout.rows.length }];
    changeLayout({ rows, tiers: { ...board.layout.tiers, [id]: [] } });
    setStatus("已新增档位，可修改名称和颜色；保存后生效。");
    if (rowEditor.current) { rowEditor.current.open = true; rowEditor.current.scrollIntoView({ block: "nearest" }); }
    requestAnimationFrame(() => rowEditor.current?.querySelector<HTMLInputElement>(`[data-row-name="${id}"]`)?.focus());
  }

  function removeRow(id: string) {
    if (busy || board.layout.rows.length <= 2) return;
    const count = board.layout.tiers[id]?.length ?? 0;
    if (count && !window.confirm(`删除这个档位会将其中 ${count} 部作品移回待排区，可以撤销。继续？`)) return;
    const rows = board.layout.rows.filter((row) => row.id !== id).map((row, order) => ({ ...row, order }));
    changeLayout({ rows, tiers: Object.fromEntries(rows.map((row) => [row.id, board.layout.tiers[row.id]])) });
    setStatus(`已删除档位${count ? `，${count} 部作品已移回待排区` : ""}，可撤销。`);
  }

  function moveRow(index: number, direction: number) {
    const target = index + direction;
    if (busy || target < 0 || target >= board.layout.rows.length) return;
    const rows = [...board.layout.rows];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    changeLayout({ ...board.layout, rows: rows.map((row, order) => ({ ...row, order })) });
  }

  async function save(publish = false) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/pools/${board.pool.id}/tier-maker`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: board.title, layout: board.layout, revision: board.revision, publish })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "保存失败，请重试。");
      setBoard((current) => ({ ...current, title: current.title.trim(), revision: result.data.revision, shareUrl: result.data.shareUrl }));
      setSavedContent(JSON.stringify({ title: board.title.trim(), layout: board.layout }));
      recovery.dismiss();
      if (publish) {
        const copied = await copyToClipboard(new URL(result.data.shareUrl, window.location.origin).href);
        setStatus(copied.ok ? "分享链接已复制。之后修改草稿，需要再次点击更新分享。" : "已生成分享链接，可在下方手动复制。");
      } else setStatus("已保存，下次可以继续排榜。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败。"); }
    finally { setBusy(false); }
  }

  function restoreDraft() {
    if (!recovery.pending) return;
    if (recovery.pending.baseVersion !== String(board.revision) && !window.confirm("服务器榜单已更新。仍要恢复本标签页的修改到编辑区？之后点击保存才会更新服务器。")) return;
    try {
      const data = recovery.pending.data;
      if (!data || typeof data.title !== "string") throw new Error("暂存标题无效。");
      // A user may have left the title empty while editing; preserve that text.
      const parsed = validateManualBoard({ ...data, title: data.title.trim() || "未命名榜单", revision: board.revision }, new Set(byId.keys()));
      setHistory((current) => [...current.slice(-29), board.layout]);
      setBoard((current) => ({ ...current, title: data.title, layout: parsed.layout }));
      recovery.dismiss();
      setStatus("已恢复修改，请检查后保存。导出图片会包含当前编辑内容。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "暂存内容无法恢复。"); }
  }

  async function revoke() {
    if (!window.confirm("关闭公开分享？旧链接将无法访问，你的草稿会保留。")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/pools/${board.pool.id}/tier-maker`, { method: "DELETE", headers: { "If-Match": String(board.revision) } });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "关闭分享失败。");
      setBoard((current) => ({ ...current, revision: result.data.revision, shareUrl: null }));
      setStatus("公开分享已关闭。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "关闭分享失败。"); }
    finally { setBusy(false); }
  }

  async function exportPng() {
    setBusy(true); setError(null);
    try {
      setExportShare(buildManualBoardShare(board));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (!exportRef.current) throw new Error("导出预览尚未就绪，请重试。");
      await exportShareCardAsPng(exportRef.current, { filename: "animatch-tier-list", onProgress: setStatus });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "导出失败。"); }
    finally { setBusy(false); setExportShare(null); }
  }

  function card(item: TierShareSnapshotItem, row?: string) {
    return <div key={item.animeId} {...dropProps(row, row ? item.animeId : undefined)} className="w-[72px] shrink-0 sm:w-20">
      <button type="button" draggable={!!editable} disabled={busy}
      aria-pressed={selectedIds.includes(item.animeId)} aria-label={`选择 ${item.title}${row ? `，位于 ${board.layout.rows.find((entry) => entry.id === row)?.label}` : "，待排作品"}`}
      onDragStart={(event) => {
        if (!editable) { event.preventDefault(); return; }
        event.stopPropagation();
        dragIds.current = multiSelect && selectedIds.includes(item.animeId) ? selectedIds : [item.animeId];
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.animeId);
        event.dataTransfer.setDragImage(event.currentTarget, 36, 48);
        setDragging(true);
      }}
      onDragEnd={endDrag}
      onClick={() => setSelectedIds((current) => multiSelect ? current.includes(item.animeId) ? current.filter((id) => id !== item.animeId) : [...current, item.animeId] : current.length === 1 && current[0] === item.animeId ? [] : [item.animeId])}
      className={`w-full cursor-grab select-none overflow-hidden rounded-lg border text-left active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${selectedIds.includes(item.animeId) ? "border-cyan-300 ring-2 ring-cyan-300" : "border-white/10 hover:border-white/40"}`}>
      <AnimeCover src={item.coverUrl} secondarySrc={getAnimeSourceCoverCandidates(item).find((url) => url !== item.coverUrl)} fallbackSrcs={getAnimeSourceCoverCandidates(item)} title={item.title} size="sm" className="aspect-[2/3] h-auto w-full rounded-none border-0" />
      <span className="line-clamp-2 h-9 px-1 py-1 text-[11px] leading-[14px] text-slate-200" title={item.title}>{item.title}</span>
    </button>
    {search && <span className="block truncate py-1 text-center text-[11px] text-cyan-200">{row ? board.layout.rows.find((entry) => entry.id === row)?.label : "待排"}</span>}
    </div>;
  }

  return <div className={`space-y-4 ${selectedIds.length ? "pb-72 sm:pb-0" : ""}`}>
    {recovery.pending && <DraftRecoveryNotice changed={recovery.pending.baseVersion !== String(board.revision)} onRestore={restoreDraft} onDiscard={recovery.dismiss} />}
    {recovery.storageError && <p role="alert" className="text-sm text-amber-200">{recovery.storageError}</p>}
    {error && recovery.pending && <p role="alert" className="text-sm text-red-200">{error}</p>}
    <fieldset disabled={!recovery.ready || !!recovery.pending} className="min-w-0 space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm text-cyan-200">自由排榜 · {board.pool.name}</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">制作我的 Tier List</h1></div>
      <Link href={`/pools/${board.pool.id}`} className={appButtonClasses({ variant: "ghost" })}>返回番组</Link>
    </header>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <label className="w-full min-w-0 text-xs text-slate-400 sm:w-auto sm:min-w-[200px] sm:flex-1">榜单标题<input className="anime-field mt-1 block w-full" maxLength={100} value={board.title} disabled={busy} onChange={(event) => { setBoard({ ...board, title: event.target.value }); }} /></label>
      <AppButton variant="primary" onClick={() => save()} disabled={busy || !board.title.trim()}>{busy ? "处理中…" : "保存草稿"}</AppButton>
      <AppButton variant="secondary" onClick={exportPng} disabled={busy || ranked.size === 0}>导出图片</AppButton>
      <label className="flex min-h-11 items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-cyan-400"
          checked={showItemTitles}
          disabled={busy}
          onChange={(event) => setShowItemTitles(event.target.checked)}
        />
        显示作品名称
      </label>
      <AppButton variant="secondary" onClick={() => { if (window.confirm("生成公开链接后，任何拿到链接的人都能查看当前已分档的作品。继续分享？")) void save(true); }} disabled={busy || ranked.size === 0 || !board.title.trim()}>{board.shareUrl ? "更新分享" : "分享榜单"}</AppButton>
      <span className={`text-xs ${dirty ? "text-amber-200" : "text-slate-400"}`}>{dirty ? recovery.ready && !recovery.storageError ? "未保存到账号 · 此标签页暂存" : "有未保存修改" : board.revision ? "草稿已保存" : "新榜单"}</span>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
    <p role="status" className="min-h-5 text-sm text-cyan-100">{status}</p>
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={multiSelect} disabled={busy} onChange={(event) => { setMultiSelect(event.target.checked); setSelectedIds([]); }} />批量选择</label>
      <details className="text-xs text-slate-400">
        <summary className="min-h-11 cursor-pointer py-3">操作说明</summary>
        <p className="pb-3">{multiSelect ? "点选多部后点击档位，或直接拖动任意已选封面一起移动；一次撤销即可恢复。" : "直接拖动封面分档；也支持点作品 → 点档位，手机和键盘均可操作。"}</p>
      </details>
    </div>
    {dragging && <div role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-xl border border-cyan-300/40 bg-slate-950 p-3 text-sm text-cyan-100">正在移动 {dragIds.current.length} 部作品 · {dragTarget === null ? "拖到档位后松手，Esc 取消" : `松手放入 ${board.layout.rows.find((row) => row.id === dragTarget)?.label ?? "待排作品"}`}</div>}
    {board.shareUrl && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-3 text-sm">
      <label className="min-w-0 flex-1">公开链接<input aria-label="公开分享链接" readOnly className="anime-field mt-1 w-full" value={typeof window === "undefined" ? board.shareUrl : new URL(board.shareUrl, window.location.origin).href} onFocus={(event) => event.target.select()} /></label>
      <a href={board.shareUrl} target="_blank" rel="noreferrer" className={appButtonClasses({ variant: "ghost" })}>查看分享</a>
      <AppButton variant="ghost" onClick={revoke} disabled={busy}>关闭分享</AppButton>
      <p className="w-full text-xs text-slate-400">仅包含上次分享时已分档的作品。保存草稿不会更新公开链接里的内容。</p>
    </div>}
    {selectedIds.length > 0 && <div role="region" aria-label="选中作品操作" className="fixed inset-x-3 bottom-3 z-30 flex max-h-[45dvh] flex-wrap items-center gap-2 overflow-y-auto rounded-xl border border-cyan-300/30 bg-slate-950 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl sm:sticky sm:inset-x-auto sm:bottom-auto sm:top-32 xl:top-24">
      <span className="w-full truncate text-sm">已选择：{selected ? byId.get(selected)?.title : `${selectedIds.length} 部作品（包含其他页的选择）`} · 点击档位放入</span>
      {board.layout.rows.map((row) => <button key={row.id} aria-label={`将选中作品放入 ${row.label}`} disabled={busy} className="min-h-11 min-w-11 max-w-full break-words rounded-lg px-3 font-bold text-slate-950" style={{ backgroundColor: row.color }} onClick={() => moveItems(selectedIds, row.id)}>{row.label}</button>)}
      <AppButton variant="secondary" disabled={busy} onClick={() => moveItems(selectedIds)}>移回待排</AppButton>
      {selected && selectedRow && <><AppButton variant="ghost" disabled={busy || board.layout.tiers[selectedRow.id].indexOf(selected) === 0} onClick={() => { const ids = board.layout.tiers[selectedRow.id]; move(selected, selectedRow.id, ids[ids.indexOf(selected) - 1]); }}>前移</AppButton>
        <AppButton variant="ghost" disabled={busy || board.layout.tiers[selectedRow.id].at(-1) === selected} onClick={() => { const ids = board.layout.tiers[selectedRow.id]; move(selected, selectedRow.id, ids[ids.indexOf(selected) + 2]); }}>后移</AppButton></>}
      <AppButton variant="ghost" onClick={() => setSelectedIds([])}>取消选择</AppButton>
    </div>}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="我的分档" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3"><h2 className="font-bold">已分档 {ranked.size} / {board.items.length}</h2>
          <AppButton size="sm" variant="secondary" disabled={busy || board.layout.rows.length >= 7} onClick={addRow}>＋ 添加档位</AppButton>
          <AppButton size="sm" variant="ghost" disabled={busy || !history.length} onClick={() => { setBoard({ ...board, layout: history[history.length - 1] }); setHistory(history.slice(0, -1)); setStatus("已撤销上一步分档修改。"); }}>撤销一步</AppButton></div>
        <div data-tier-scroll className="max-h-[44vh] overflow-y-auto overscroll-contain sm:max-h-[65vh]">
          {board.layout.rows.map((row) => <div key={row.id} {...dropProps(row.id)} className={`grid min-h-24 grid-cols-[64px_minmax(0,1fr)] border-b border-white/10 last:border-0 sm:grid-cols-[84px_minmax(0,1fr)] ${dragTarget === row.id ? "bg-cyan-300/10 ring-2 ring-inset ring-cyan-300" : ""}`}>
            <button disabled={busy} aria-disabled={!selectedIds.length} aria-label={`放入 ${row.label}`} onClick={() => moveItems(selectedIds, row.id)} className="break-all px-2 text-lg font-black text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ backgroundColor: row.color }}>{row.label}<span className="mt-2 block text-xs font-medium">{board.layout.tiers[row.id]?.length ?? 0} 部</span></button>
            <div className="flex min-w-0 flex-wrap content-start gap-2 p-2">{(board.layout.tiers[row.id] ?? []).map((id) => byId.has(id) ? card(byId.get(id)!, row.id) : null)}
            </div>
          </div>)}
        </div>
      </section>
      <aside aria-label="待排作品" className="min-w-0 space-y-4">
        <section {...dropProps()} className={`rounded-2xl border bg-slate-950/40 p-3 ${dragTarget === "" ? "border-cyan-300 ring-2 ring-cyan-300/40" : "border-white/10"}`}>
          <h2 className="font-bold">{search ? "全部作品搜索" : "待排作品"} <span className="text-slate-400">{filtered.length}</span></h2>
          <label className="sr-only" htmlFor="unranked-search">搜索所有作品，包括已分档</label><input id="unranked-search" className="anime-field my-3 w-full" placeholder="搜索所有作品，包括已分档" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
          {query && <AppButton size="sm" variant="quiet" onClick={() => { setQuery(""); setPage(0); }}>清除搜索 · 返回待排区</AppButton>}
          {multiSelect && <AppButton size="sm" variant="secondary" disabled={busy || !filtered.length} onClick={() => setSelectedIds((current) => [...new Set([...current, ...filtered.slice(currentPage * 24, (currentPage + 1) * 24).map((item) => item.animeId)])])}>选择本页 {filtered.slice(currentPage * 24, (currentPage + 1) * 24).length} 部</AppButton>}
          <div data-tier-scroll className="flex max-h-[48vh] flex-wrap content-start gap-2 overflow-y-auto p-1">{filtered.slice(currentPage * 24, (currentPage + 1) * 24).map((item) => card(item, board.layout.rows.find((row) => board.layout.tiers[row.id]?.includes(item.animeId))?.id))}
            {!filtered.length && <p className="py-8 text-sm text-slate-400">{query ? "没有找到匹配的作品。" : board.items.length ? "全部排好了！也可以把作品移回这里。" : "番组里还没有作品，请先返回番组添加。"}</p>}</div>
          {maxPage > 0 && <div className="mt-3 flex items-center justify-between text-xs"><AppButton size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</AppButton><span>{currentPage + 1} / {maxPage + 1}</span><AppButton size="sm" variant="ghost" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}>下一页</AppButton></div>}
        </section>
        <details ref={rowEditor} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">管理档位 · 名称、颜色与顺序</summary>
          <p className="text-xs text-slate-400">支持 2–7 个档位，删除、移动和新增都可以撤销。</p>
          <AppButton className="my-2" variant="secondary" disabled={busy || board.layout.rows.length >= 7} onClick={addRow}>添加档位（{board.layout.rows.length}/7）</AppButton>
          <label className="text-xs text-slate-400">更换模板<select className="anime-field my-2 w-full" value="" disabled={busy} onChange={(event) => {
            const rows = TIER_TEMPLATES[event.target.value] ?? DEFAULT_TIER_CONFIG.rows;
            if (ranked.size && !window.confirm("更换模板会把所有作品放回待排区，可以撤销。继续？")) return;
            changeLayout({ rows, tiers: Object.fromEntries(rows.map((row) => [row.id, []])) });
          }}><option value="" disabled>选择档位模板</option><option value="standard">S / A / B / C / D</option><option value="extended">SS / S / A / B / C / D</option><option value="chinese">神作 / 优秀 / 不错 / 一般 / 不喜欢</option><option value="simple">喜欢 / 一般 / 不喜欢</option></select></label>
          {board.layout.rows.map((row, index) => <div key={row.id} className="my-3 min-w-0 rounded-xl border border-white/10 p-2"><div className="flex min-w-0 gap-2">
            <input type="color" aria-label={`${row.label} 的颜色`} value={row.color} disabled={busy} className="h-11 w-11 shrink-0 cursor-pointer bg-transparent" onChange={(event) => changeLayout({ ...board.layout, rows: board.layout.rows.map((entry) => entry.id === row.id ? { ...entry, color: event.target.value } : entry) })} />
            <input data-row-name={row.id} aria-label={`${row.id} 档位名称`} value={row.label} maxLength={12} disabled={busy} className="anime-field w-full min-w-0" onChange={(event) => changeLayout({ ...board.layout, rows: board.layout.rows.map((entry) => entry.id === row.id ? { ...entry, label: event.target.value } : entry) })} />
          </div><div className="mt-2 flex flex-wrap gap-1"><AppButton size="sm" variant="quiet" disabled={busy || index === 0} aria-label={`上移 ${row.label} 档位`} onClick={() => moveRow(index, -1)}>上移</AppButton><AppButton size="sm" variant="quiet" disabled={busy || index === board.layout.rows.length - 1} aria-label={`下移 ${row.label} 档位`} onClick={() => moveRow(index, 1)}>下移</AppButton><AppButton size="sm" variant="ghost" disabled={busy || board.layout.rows.length <= 2} aria-label={`删除 ${row.label} 档位`} onClick={() => removeRow(row.id)}>删除</AppButton></div></div>)}
        </details>
      </aside>
    </div>
    {exportShare && <div aria-hidden="true" ref={exportRef} style={{ position: "fixed", left: -20000, top: 0, width: 1280, pointerEvents: "none" }}><TierShareCard share={exportShare} exportMode showItemTitles={showItemTitles} /></div>}
    </fieldset>
  </div>;
}
