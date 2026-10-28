"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { songRequest, SongApiError, downloadSongFile } from "@/lib/anisong/client";
import { nextSongPair, rankSongs, songSnapshot } from "@/lib/anisong/engine";
import { exportSongPng } from "@/lib/anisong/export";
import { KIND_LABELS, SONG_KINDS, MAX_TRACKS, type SongBoardView, type SongDecision, type SongTrack } from "@/lib/anisong/types";
import { SongForm } from "./SongForm";
import { SongBatchImport } from "./SongBatchImport";
import { SongPlayer } from "./SongPlayer";
import { SongTierView } from "./SongTierView";
import { SongCover } from "./SongCover";
import { SongMatchCard } from "./SongMatchCard";
import { MatchArena, MatchHeading } from "@/components/MatchPresentation";
import { registerUnsavedChangesGuard } from "@/lib/unsaved-changes-guard";

type Tab = "library" | "match" | "tier";
export function SongWorkspace({ boardId }: { boardId: string }) {
  const [board, setBoard] = useState<SongBoardView | null>(null);
  const [tab, setTab] = useState<Tab>("library");
  const [busy, setBusy] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const latestBoard = useRef<SongBoardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [login, setLogin] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<SongTrack | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [year, setYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [renaming, setRenaming] = useState(false);
  const lock = useRef(false);
  const endpoint = `/api/anisong/boards/${boardId}`;
  function changeTab(next: Tab) {
    if (lock.current || importing) return;
    if (next !== tab && (editing || batchOpen) && !window.confirm("编辑或导入面板尚未收起，要放弃待保存内容并切换吗？")) return;
    if (next !== tab) { setEditing(null); setBatchOpen(false); }
    setTab(next);
    const url = new URL(window.location.href); url.searchParams.set("view", next);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new CustomEvent("anisong:play", { detail: null }));
  }
  const reload = useCallback(async () => {
    setLoading(true);
    try { const value = await songRequest<SongBoardView>(endpoint); latestBoard.current = value; setBoard(value); setConflict(false); setError(""); setLogin(false); }
    catch (e) { setError(e instanceof Error ? e.message : "加载失败"); setLogin(e instanceof SongApiError && e.status === 401); }
    finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "library" || view === "match" || view === "tier") setTab(view);
    void reload();
  }, [reload]);
  useEffect(() => { setShareUrl(board?.shareToken ? `${window.location.origin}/anisong/share/${board.shareToken}` : ""); }, [board?.shareToken]);
  useEffect(() => {
    if (!editing && !batchOpen && !busy && !importing) return;
    return registerUnsavedChangesGuard(window, busy || importing ? "操作尚未完成，确定离开吗？" : "编辑或导入面板尚未收起，确定放弃待保存内容并离开吗？");
  }, [editing, batchOpen, busy, importing]);
  function editTrack(next: SongTrack | "new" | null) {
    if (lock.current || importing) return;
    if (next === editing || (next && next !== "new" && editing && editing !== "new" && next.id === editing.id)) return;
    if ((editing || batchOpen) && !window.confirm("放弃当前未保存的歌曲编辑？")) return;
    setBatchOpen(false); setEditing(next);
  }

  async function mutate(input: Record<string, unknown>, form?: FormData): Promise<boolean> {
    const currentBoard = latestBoard.current;
    if (!currentBoard || lock.current || conflict || (importing && !form?.get("importKey"))) return false;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    window.dispatchEvent(new CustomEvent("anisong:play", { detail: null }));
    try {
      if (form) form.set("revision", String(currentBoard.revision));
      const next = await songRequest<SongBoardView>(form ? `${endpoint}/tracks` : endpoint, form ? { method: "POST", body: form } : {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, revision: currentBoard.revision })
      });
      latestBoard.current = next; setBoard(next); setNotice("已保存"); return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      // A failed network response may have committed. Require a fresh revision before retrying.
      if (!(e instanceof SongApiError) || e.status === 409 || e.status >= 500) setConflict(true);
      if (e instanceof SongApiError && e.status === 401) setLogin(true);
      return false;
    } finally { lock.current = false; setBusy(false); }
  }

  const ranking = useMemo(() => board ? rankSongs(board.document) : null, [board]);
  const snapshot = useMemo(() => board ? songSnapshot(board.title, board.document) : null, [board]);
  const pair = useMemo(() => board ? nextSongPair(board.document) : null, [board]);
  const visibleTracks = useMemo(() => board?.document.tracks.filter(t =>
    (!kind || t.kind === kind) && (!year || String(t.year) === year) && (!quarter || String(t.quarter) === quarter) &&
    (!search || [t.title, t.artist, t.anime, ...t.tags].some(s => s.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
  ) ?? [], [board, search, kind, year, quarter]);
  const vote = (result: SongDecision) => {
    if (pair) void mutate({ action: "vote", eventId: crypto.randomUUID(), leftId: pair.left.id, rightId: pair.right.id, result });
  };
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if (tab !== "match" || !pair || busy || conflict || loading || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, button, a, [contenteditable=true]")) return;
      const result = ({ ArrowLeft: "LEFT_WIN", ArrowRight: "RIGHT_WIN", ArrowUp: "DRAW", ArrowDown: "SKIP", "1": "LEFT_WIN", "2": "RIGHT_WIN", "3": "DRAW", "4": "SKIP" } as Record<string, SongDecision>)[e.key];
      if (result) { e.preventDefault(); vote(result); }
    }
    window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard);
  });
  async function exportPng() {
    if (!snapshot || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { const result = await exportSongPng(snapshot); setNotice(result.missingCovers ? `已导出；${result.missingCovers} 张封面未能载入，可上传本地封面后重试。` : "带封面的榜单已导出"); } catch (e) { setError(e instanceof Error ? e.message : "导出失败"); } finally { lock.current = false; setBusy(false); }
  }
  async function removeBoard() {
    if (!board || lock.current || !window.confirm(`永久删除「${board.title}」、上传音频和对决记录？分享链接也会失效。`)) return;
    lock.current = true; setBusy(true);
    try {
      await songRequest(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: board.revision }) });
      lock.current = false;
      window.location.assign("/anisong");
    } catch (e) { setError(e instanceof Error ? e.message : "删除失败"); setConflict(true); lock.current = false; setBusy(false); }
  }
  const disabled = busy || importing || conflict || loading || login;
  if (!board) return <div className="mx-auto max-w-4xl space-y-5"><Link href="/anisong" className="text-anime-cyan">← 音乐曲单</Link>{loading ? <p role="status">正在加载曲单…</p> : <div role="alert"><p>{error}</p>{login ? <Link href={`/login?next=${encodeURIComponent(`/anisong/${boardId}`)}`} className="text-anime-cyan underline">去登录</Link> : <AppButton onClick={() => void reload()}>重试</AppButton>}</div>}</div>;
  return <div className="mx-auto max-w-6xl space-y-4">
    {tab === "match" ? <MatchHeading mode="music" title={board.title} backHref="/anisong" description="先试听，再选择更喜欢的一首。点击封面或选择按钮会记录对决；播放按钮只负责试听。平局计入比较，跳过不改变评分；未听过的歌曲可在曲单中恢复。"
      context={<span className="text-slate-400">{ranking?.active.length} 首 · {ranking?.progress.effectiveComparisons} 次比较</span>}
      tools={<><span role="status" className="text-xs text-slate-400">{busy ? "正在处理…" : conflict ? "请重新载入" : notice || "进度已保存"}</span><AppButton variant="ghost" size="sm" disabled={disabled || !board.document.events.length} onClick={() => void mutate({ action: "undo" })}>撤回上一步</AppButton></>}
    /> : <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><Link href="/anisong" className="text-sm text-anime-cyan">← ANISONGMATCH</Link><h1 className="mt-2 break-words text-xl font-bold sm:text-2xl">{board.title}</h1><p className="mt-1 text-xs text-slate-400">{board.document.tracks.length} 首歌曲 · {ranking?.active.length} 首参与对决 · {ranking?.progress.effectiveComparisons} 次有效比较</p></div>
      <div className="flex items-center gap-3"><span role="status" className="text-xs text-slate-400">{busy ? "正在处理…" : conflict ? "请重新载入确认进度" : notice || "进度已保存"}</span><AppButton variant="ghost" size="sm" disabled={disabled} onClick={() => setRenaming(!renaming)}>改名</AppButton></div>
    </header>}
    {renaming && <form className="flex gap-3" onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); if (await mutate({ action: "rename", title: data.get("title") })) setRenaming(false); }}><input aria-label="曲单名称" name="title" defaultValue={board.title} maxLength={80} required className="anime-field" /><AppButton type="submit" disabled={disabled}>保存</AppButton></form>}
    {error && <div role="alert" className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-100"><p>{error}</p>{conflict && <><p>当前操作未确认。重新载入已保存进度后即可继续。</p><AppButton size="sm" onClick={() => void reload()} disabled={busy || loading}>重新载入</AppButton></>}{login && <Link href={`/login?next=${encodeURIComponent(`/anisong/${boardId}`)}`} className="underline">重新登录</Link>}</div>}
    <div role="tablist" aria-label="音乐曲单视图" className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/30 p-1.5">
      {([["library", "曲单"], ["match", "音乐对决"], ["tier", "Tier List"]] as const).map(([key, label]) => <button key={key} id={`tab-${key}`} role="tab" disabled={busy || importing} aria-selected={tab === key} aria-controls={`panel-${key}`} className={`min-h-12 rounded-xl px-3 text-sm font-semibold ${tab === key ? "bg-anime-cyan text-slate-950" : "text-slate-300 hover:bg-white/5"}`} onClick={() => changeTab(key)}>{label}</button>)}
    </div>
    {tab === "library" && <section role="tabpanel" id="panel-library" aria-labelledby="tab-library" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">按季度、类型或风格筛选，再选择参赛范围。</p><div className="flex flex-wrap gap-2"><AppButton variant="ghost" disabled={disabled || batchOpen || board.document.tracks.length >= MAX_TRACKS} onClick={() => { if ((editing || batchOpen) && !window.confirm("放弃当前未保存的编辑或待导入文件？")) return; setEditing(null); setBatchOpen(true); }}>批量导入音频</AppButton><AppButton disabled={disabled || board.document.tracks.length >= MAX_TRACKS} onClick={() => editTrack("new")}>＋ 添加歌曲</AppButton></div></div>
      {batchOpen && <SongBatchImport tracks={board.document.tracks} disabled={busy || conflict || loading || login} onRunning={setImporting} onSave={data => mutate({}, data)} onCancel={() => { if (window.confirm("收起导入面板？已保存歌曲会保留，待导入文件需重新选择。")) setBatchOpen(false); }} />}
      {editing && <SongForm boardId={boardId} key={editing === "new" ? "new" : editing.id} track={editing === "new" ? undefined : editing} busy={disabled} onCancel={() => editTrack(null)} onSave={async data => { const saved = await mutate({}, data); if (saved) setEditing(null); return saved; }} />}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <input aria-label="搜索歌曲或风格" placeholder="歌名 / 歌手 / 动画 / 风格" className="anime-field" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="歌曲类型" className="anime-field" value={kind} onChange={e => setKind(e.target.value)}><option value="">全部类型</option>{SONG_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select>
        <select aria-label="年份" className="anime-field" value={year} onChange={e => setYear(e.target.value)}><option value="">全部年份</option>{[...new Set(board.document.tracks.map(t => t.year).filter((v): v is number => v !== null))].sort((a, b) => b - a).map(y => <option key={y}>{y}</option>)}</select>
        <select aria-label="季度" className="anime-field" value={quarter} onChange={e => setQuarter(e.target.value)}><option value="">全部季度</option>{["冬季", "春季", "夏季", "秋季"].map((s, i) => <option key={s} value={i + 1}>{s}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center gap-3"><AppButton variant="secondary" size="sm" disabled={disabled || Boolean(editing) || batchOpen || visibleTracks.length < 2} onClick={async () => { if (await mutate({ action: "candidates", trackIds: visibleTracks.map(t => t.id) })) changeTab("match"); }}>用筛选的 {visibleTracks.length} 首开始对决</AppButton>{board.document.candidateIds !== null && <AppButton variant="ghost" size="sm" disabled={disabled} onClick={() => void mutate({ action: "candidates", trackIds: null })}>恢复全曲单参赛</AppButton>}<span className="text-xs text-slate-500">分档仅使用参赛歌曲之间的比较；切换范围保留历史。</span></div>
      {visibleTracks.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center"><p className="text-lg font-semibold">{board.document.tracks.length ? "没有符合筛选的歌曲" : "把舍不得跳过的歌放进来"}</p><p className="mt-1 text-xs text-slate-400">{board.document.tracks.length ? "试试其他季度、类型或关键词。" : "添加至少两首歌曲，就能开始第一场对决。"}</p></div> : <div className="grid gap-3 sm:grid-cols-2">
        {visibleTracks.map(track => {
          const score = ranking?.scores.find(s => s.animeId === track.id);
          const excluded = board.document.candidateIds !== null && !board.document.candidateIds.includes(track.id);
          return <article key={`${track.id}-${board.revision}`} className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-slate-950/30 p-5">
            <div className="flex items-start gap-3"><SongCover src={track.coverUrl} title={track.title} className="w-20" /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{track.title}</h3><p className="mt-1 break-words text-sm text-slate-400">{track.artist || "歌手未填写"}</p></div><span className="rounded-md bg-anime-purple/10 px-2 py-1 text-xs text-anime-purple">{KIND_LABELS[track.kind]}</span></div>
            <p className="break-words text-xs text-slate-400">{[track.anime, track.year, track.quarter ? ["冬季", "春季", "夏季", "秋季"][track.quarter - 1] : "", ...track.tags].filter(Boolean).join(" · ") || "可在编辑中补充动画、季度和风格"}</p>
            <SongPlayer track={track} boardId={boardId} />
            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
              <span className="mr-auto text-xs text-slate-500">{excluded ? "未参赛" : score?.isHidden ? "未听过" : `已比较 ${score?.compareCount ?? 0} 次`}</span>
              {score?.isHidden && <AppButton size="sm" variant="ghost" disabled={disabled} onClick={() => void mutate({ action: "restore", trackId: track.id })}>恢复</AppButton>}
              <AppButton size="sm" variant="ghost" disabled={disabled} onClick={() => { editTrack(track); window.scrollTo({ top: 0, behavior: "smooth" }); }}>编辑</AppButton>
              <AppButton size="sm" variant="ghost" disabled={disabled} onClick={() => { if (window.confirm(`移除「${track.title}」及与它相关的对决记录？榜单将重新计算。`)) void mutate({ action: "remove", trackId: track.id }); }}>移除</AppButton>
            </div>
          </article>;
        })}
      </div>}
      <div className="border-t border-white/10 pt-5"><AppButton variant="quiet" size="sm" disabled={disabled || Boolean(editing) || batchOpen} onClick={() => void removeBoard()}>删除这份曲单</AppButton></div>
    </section>}
    {tab === "match" && <section role="tabpanel" id="panel-match" aria-labelledby="tab-match" className="space-y-6">
      <h2 className="text-center text-sm font-semibold text-slate-300">哪首更让你心动？先试听，再选择。</h2>
      {pair ? <>
        <div className="mx-auto max-w-4xl"><MatchArena
          left={<SongMatchCard key={`left-${board.revision}`} track={pair.left} boardId={boardId} side="left" disabled={disabled} onPick={() => vote("LEFT_WIN")} onUnheard={() => vote("LEFT_UNSEEN")} />}
          right={<SongMatchCard key={`right-${board.revision}`} track={pair.right} boardId={boardId} side="right" disabled={disabled} onPick={() => vote("RIGHT_WIN")} onUnheard={() => vote("RIGHT_UNSEEN")} />}
        /></div>
        <div className="flex justify-center gap-3"><AppButton variant="secondary" disabled={disabled} onClick={() => vote("DRAW")}>一样喜欢</AppButton><AppButton variant="ghost" disabled={disabled} onClick={() => vote("SKIP")}>跳过这组</AppButton></div>
        <p className="text-center text-xs text-slate-500">← / → 选左右 · ↑ 平局 · ↓ 跳过（也支持 1 / 2 / 3 / 4）</p>
      </> : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center"><p>参与对决的歌曲不足两首。</p><p className="mt-2 text-sm text-slate-400">添加歌曲、调整参赛范围，或恢复「未听过」的歌。</p><AppButton className="mt-5" onClick={() => changeTab("library")}>管理曲单</AppButton></div>}
      {ranking && <div className="rounded-2xl border border-white/10 p-5"><div className="flex justify-between gap-3 text-sm"><span>{ranking.progress.stage === "EMPTY" ? "等待开始" : ranking.progress.stageLabel}</span><button className="text-anime-cyan" onClick={() => changeTab("tier")}>查看当前 Tier List →</button></div><progress aria-label="对决进度" value={ranking.progress.progressRatio} max={1} className="mt-3 h-2 w-full accent-teal-300" /><p className="mt-2 text-xs text-slate-400">{ranking.progress.remainingToNextStage > 0 ? `再比较 ${ranking.progress.remainingToNextStage} 次，${ranking.progress.nextTargetLabel}。` : "可以继续比较，或查看榜单。"}进度是比较次数参考，不代表统计置信度。</p></div>}
    </section>}
    {tab === "tier" && snapshot && <section role="tabpanel" id="panel-tier" aria-labelledby="tab-tier" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">我的音乐 Tier List</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">自动档位反映当前曲单内的相对偏好。可以手动分档，比较分数和历史会保留；选回「自动分档」即可恢复。</p></div><div className="flex flex-wrap gap-2"><AppButton variant="secondary" disabled={disabled} onClick={() => void exportPng()}>导出 PNG</AppButton><AppButton variant="ghost" disabled={disabled} onClick={() => downloadSongFile(`${board.title.replace(/[\\/:*?"<>|]/g, "_")}-TierList.json`, new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }))}>导出榜单 JSON</AppButton></div></div>
      <SongTierView snapshot={snapshot} busy={disabled} onTier={(trackId, tier) => void mutate({ action: "tier", trackId, tier })} />
      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/30 p-5"><h3 className="font-semibold">分享这一刻的榜单</h3><p className="text-sm text-slate-400">公开快照包含歌曲封面、信息与分档，不包含音频。继续对决不会改变已分享的快照。</p><div className="flex flex-wrap gap-2"><AppButton disabled={disabled} onClick={() => void mutate({ action: "publish" })}>{board.shareToken ? "更新分享快照" : "生成分享链接"}</AppButton>{board.shareToken && <AppButton variant="ghost" disabled={disabled} onClick={() => void mutate({ action: "unpublish" })}>关闭分享</AppButton>}</div>{shareUrl && <div className="flex flex-wrap items-center gap-3"><input readOnly aria-label="分享链接" value={shareUrl} className="anime-field min-w-0 flex-1" onFocus={e => e.target.select()} /><AppButton variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setNotice("分享链接已复制"); } catch { setError("复制失败，请选中链接手动复制。"); } }}>复制</AppButton><Link href={`/anisong/share/${board.shareToken}`} target="_blank" className="text-sm text-anime-cyan underline">查看快照</Link></div>}</div>
    </section>}
  </div>;
}
