"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimeCover } from "./AnimeCover";
import { TierShareCard } from "./TierShareView";
import { AppButton, appButtonClasses } from "./ui/AppButton";
import { buildManualBoardShare, moveBoardItem, type ManualBoardData } from "@/lib/manual-board";
import { getAnimeSourceCoverCandidates } from "@/lib/anime-cover-url";
import { DEFAULT_TIER_CONFIG, TIER_TEMPLATES } from "@/lib/tier-config";
import { copyToClipboard } from "@/lib/clipboard";
import { exportShareCardAsPng } from "@/lib/share-export";
import type { PublicTierShare, TierShareSnapshotItem } from "@/lib/client-api";

export function ManualTierBoard({ initial }: { initial: ManualBoardData }) {
  const [board, setBoard] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("拖动作品，或选中作品后点击档位放入。");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<ManualBoardData["layout"][]>([]);
  const [exportShare, setExportShare] = useState<PublicTierShare | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);
  const byId = useMemo(() => new Map(board.items.map((item) => [item.animeId, item])), [board.items]);
  const ranked = useMemo(() => new Set(Object.values(board.layout.tiers).flat()), [board.layout]);
  const unranked = board.items.filter((item) => !ranked.has(item.animeId));
  const filtered = unranked.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  const maxPage = Math.max(0, Math.ceil(filtered.length / 24) - 1);
  const currentPage = Math.min(page, maxPage);
  const selectedRow = board.layout.rows.find((row) => board.layout.tiers[row.id]?.includes(selected ?? ""));

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeNavigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || (target.pathname === window.location.pathname && target.search === window.location.search)) return;
      if (!window.confirm("还有未保存的修改，确定离开？")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeNavigate, true); };
  }, [dirty]);

  function changeLayout(layout: ManualBoardData["layout"]) {
    if (busy) return;
    setHistory((current) => [...current.slice(-29), board.layout]);
    setBoard((current) => ({ ...current, layout }));
    setDirty(true);
    setError(null);
  }

  function move(id: string, row?: string, before?: string) {
    if (!byId.has(id) || busy) return;
    changeLayout(moveBoardItem(board.layout, id, row, before));
    setStatus(`${byId.get(id)!.title} 已移至${row ? board.layout.rows.find((entry) => entry.id === row)?.label : "待排作品"}`);
    setSelected(null);
  }

  function drop(event: React.DragEvent, row?: string, before?: string) {
    event.preventDefault(); event.stopPropagation();
    if (dragId.current) move(dragId.current, row, before);
    dragId.current = null;
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
      setDirty(false);
      if (publish) {
        const copied = await copyToClipboard(new URL(result.data.shareUrl, window.location.origin).href);
        setStatus(copied.ok ? "分享链接已复制。之后修改草稿，需要再次点击更新分享。" : "已生成分享链接，可在下方手动复制。");
      } else setStatus("已保存，下次可以继续排榜。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败。"); }
    finally { setBusy(false); }
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
    return <button key={item.animeId} type="button" draggable={!busy} disabled={busy}
      aria-pressed={selected === item.animeId} aria-label={`选择 ${item.title}`}
      onDragStart={(event) => { dragId.current = item.animeId; event.dataTransfer.setData("text/plain", item.animeId); event.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={() => { dragId.current = null; }} onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => drop(event, row, row ? item.animeId : undefined)}
      onClick={() => setSelected(selected === item.animeId ? null : item.animeId)}
      className={`w-[72px] shrink-0 overflow-hidden rounded-lg border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:w-20 ${selected === item.animeId ? "border-cyan-300 ring-2 ring-cyan-300" : "border-white/10 hover:border-white/40"}`}>
      <AnimeCover src={item.coverUrl} secondarySrc={getAnimeSourceCoverCandidates(item).find((url) => url !== item.coverUrl)} title={item.title} size="sm" className="aspect-[2/3] h-auto w-full rounded-none border-0" />
      <span className="line-clamp-2 h-9 px-1 py-1 text-[11px] leading-[14px] text-slate-200" title={item.title}>{item.title}</span>
    </button>;
  }

  return <div className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm text-cyan-200">自由排榜 · {board.pool.name}</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">制作我的 Tier List</h1>
        <p className="mt-2 text-sm text-slate-400">把作品放进你心中的档位，没看过的可以留在待排区。</p></div>
      <Link href={`/pools/${board.pool.id}`} className={appButtonClasses({ variant: "ghost" })}>返回番组</Link>
    </header>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <label className="w-full min-w-0 text-xs text-slate-400 sm:w-auto sm:min-w-[200px] sm:flex-1">榜单标题<input className="anime-field mt-1 block w-full" maxLength={100} value={board.title} disabled={busy} onChange={(event) => { setBoard({ ...board, title: event.target.value }); setDirty(true); }} /></label>
      <AppButton variant="primary" onClick={() => save()} disabled={busy || !board.title.trim()}>{busy ? "处理中…" : "保存草稿"}</AppButton>
      <AppButton variant="secondary" onClick={exportPng} disabled={busy || ranked.size === 0}>导出图片</AppButton>
      <AppButton variant="secondary" onClick={() => { if (window.confirm("生成公开链接后，任何拿到链接的人都能查看当前已分档的作品。继续分享？")) void save(true); }} disabled={busy || ranked.size === 0 || !board.title.trim()}>{board.shareUrl ? "更新分享" : "分享榜单"}</AppButton>
      <span className={`text-xs ${dirty ? "text-amber-200" : "text-slate-400"}`}>{dirty ? "有未保存修改" : board.revision ? "草稿已保存" : "新榜单"}</span>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
    <p role="status" className="min-h-5 text-sm text-cyan-100">{status}</p>
    {board.shareUrl && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-3 text-sm">
      <label className="min-w-0 flex-1">公开链接<input aria-label="公开分享链接" readOnly className="anime-field mt-1 w-full" value={typeof window === "undefined" ? board.shareUrl : new URL(board.shareUrl, window.location.origin).href} onFocus={(event) => event.target.select()} /></label>
      <a href={board.shareUrl} target="_blank" rel="noreferrer" className={appButtonClasses({ variant: "ghost" })}>查看分享</a>
      <AppButton variant="ghost" onClick={revoke} disabled={busy}>关闭分享</AppButton>
      <p className="w-full text-xs text-slate-400">仅包含上次分享时已分档的作品。保存草稿不会更新公开链接里的内容。</p>
    </div>}
    {selected && <div className="sticky top-32 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-300/30 bg-slate-950 p-3 shadow-xl sm:top-20">
      <span className="w-full truncate text-sm">已选择：{byId.get(selected)?.title} · 点击档位放入</span>
      {board.layout.rows.map((row) => <button key={row.id} disabled={busy} className="min-h-11 min-w-11 rounded-lg px-3 font-bold text-slate-950" style={{ backgroundColor: row.color }} onClick={() => move(selected, row.id)}>{row.label}</button>)}
      <AppButton variant="secondary" disabled={busy} onClick={() => move(selected)}>移回待排</AppButton>
      {selectedRow && <><AppButton variant="ghost" disabled={busy || board.layout.tiers[selectedRow.id].indexOf(selected) === 0} onClick={() => { const ids = board.layout.tiers[selectedRow.id]; move(selected, selectedRow.id, ids[ids.indexOf(selected) - 1]); }}>前移</AppButton>
        <AppButton variant="ghost" disabled={busy || board.layout.tiers[selectedRow.id].at(-1) === selected} onClick={() => { const ids = board.layout.tiers[selectedRow.id]; move(selected, selectedRow.id, ids[ids.indexOf(selected) + 2]); }}>后移</AppButton></>}
      <AppButton variant="ghost" onClick={() => setSelected(null)}>取消选择</AppButton>
    </div>}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="我的分档" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3"><h2 className="font-bold">已分档 {ranked.size} / {board.items.length}</h2>
          <AppButton size="sm" variant="ghost" disabled={busy || !history.length} onClick={() => { setBoard({ ...board, layout: history[history.length - 1] }); setHistory(history.slice(0, -1)); setDirty(true); setStatus("已撤销上一步分档修改。"); }}>撤销一步</AppButton></div>
        <div className="max-h-[44vh] overflow-y-auto overscroll-contain sm:max-h-[65vh]">
          {board.layout.rows.map((row) => <div key={row.id} className="grid min-h-24 grid-cols-[64px_minmax(0,1fr)] border-b border-white/10 last:border-0 sm:grid-cols-[84px_minmax(0,1fr)]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, row.id)}>
            <button disabled={busy || !selected} aria-label={`放入 ${row.label}`} onClick={() => selected && move(selected, row.id)} className="break-all px-2 text-lg font-black text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ backgroundColor: row.color }}>{row.label}<span className="mt-2 block text-xs font-medium">{board.layout.tiers[row.id]?.length ?? 0} 部</span></button>
            <div className="flex min-w-0 flex-wrap content-start gap-2 p-2">{(board.layout.tiers[row.id] ?? []).map((id) => byId.has(id) ? card(byId.get(id)!, row.id) : null)}
              {!board.layout.tiers[row.id]?.length && <span className="self-center px-2 py-8 text-xs text-slate-500">拖到这里，或选中作品后点击档位</span>}</div>
          </div>)}
        </div>
      </section>
      <aside aria-label="待排作品" className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event)}>
          <h2 className="font-bold">待排作品 <span className="text-slate-400">{unranked.length}</span></h2>
          <label className="sr-only" htmlFor="unranked-search">搜索待排作品</label><input id="unranked-search" className="anime-field my-3 w-full" placeholder="搜索待排作品" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
          <div className="flex max-h-[48vh] flex-wrap content-start gap-2 overflow-y-auto p-1">{filtered.slice(currentPage * 24, (currentPage + 1) * 24).map((item) => card(item))}
            {!filtered.length && <p className="py-8 text-sm text-slate-400">{query ? "没有找到匹配的作品。" : board.items.length ? "全部排好了！也可以把作品移回这里。" : "番组里还没有作品，请先返回番组添加。"}</p>}</div>
          {maxPage > 0 && <div className="mt-3 flex items-center justify-between text-xs"><AppButton size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</AppButton><span>{currentPage + 1} / {maxPage + 1}</span><AppButton size="sm" variant="ghost" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}>下一页</AppButton></div>}
        </section>
        <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">档位名称与颜色</summary>
          <label className="text-xs text-slate-400">更换模板<select className="anime-field my-2 w-full" value="" disabled={busy} onChange={(event) => {
            const rows = TIER_TEMPLATES[event.target.value] ?? DEFAULT_TIER_CONFIG.rows;
            if (ranked.size && !window.confirm("更换模板会把所有作品放回待排区，可以撤销。继续？")) return;
            changeLayout({ rows, tiers: Object.fromEntries(rows.map((row) => [row.id, []])) });
          }}><option value="" disabled>选择档位模板</option><option value="standard">S / A / B / C / D</option><option value="extended">SS / S / A / B / C / D</option><option value="chinese">神作 / 优秀 / 不错 / 一般 / 不喜欢</option><option value="simple">喜欢 / 一般 / 不喜欢</option></select></label>
          {board.layout.rows.map((row) => <div key={row.id} className="my-2 flex min-w-0 gap-2">
            <input type="color" aria-label={`${row.label} 的颜色`} value={row.color} disabled={busy} className="h-11 w-11 shrink-0 cursor-pointer bg-transparent" onChange={(event) => changeLayout({ ...board.layout, rows: board.layout.rows.map((entry) => entry.id === row.id ? { ...entry, color: event.target.value } : entry) })} />
            <input aria-label={`${row.id} 档位名称`} value={row.label} maxLength={12} disabled={busy} className="anime-field w-full min-w-0" onChange={(event) => changeLayout({ ...board.layout, rows: board.layout.rows.map((entry) => entry.id === row.id ? { ...entry, label: event.target.value } : entry) })} />
          </div>)}
        </details>
      </aside>
    </div>
    {exportShare && <div aria-hidden="true" ref={exportRef} style={{ position: "fixed", left: -20000, top: 0, width: 1280, pointerEvents: "none" }}><TierShareCard share={exportShare} exportMode /></div>}
  </div>;
}
