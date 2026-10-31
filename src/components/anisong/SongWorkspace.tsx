"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import { nextSongPair, rankSongs, songSnapshot } from "@/lib/anisong/engine";
import { cancelSongAudioPreload, preloadSongAudioPair } from "@/lib/anisong/preload-playback";
import { exportSongPng } from "@/lib/anisong/export";
import { KIND_LABELS, SONG_KINDS, MAX_TRACKS, type SongBoardView, type SongDecision, type SongTrack } from "@/lib/anisong/types";
import { SongForm } from "./SongForm";
import { SongBatchImport } from "./SongBatchImport";
import { SongNeteaseSearch } from "./SongNeteaseSearch";
import { SongItunesSearch } from "./SongItunesSearch";
import { SongTemplatePublisher, type TemplatePublishResult } from "./SongTemplatePublisher";
import { SongBulkTools } from "./SongBulkTools";
import { SongPlayer } from "./SongPlayer";
import { SongCover } from "./SongCover";
import { SongMatchPanel } from "./SongMatchPanel";
import { SongTierPanel } from "./SongTierPanel";
import { MatchHeading } from "@/components/MatchPresentation";
import { registerUnsavedChangesGuard } from "@/lib/unsaved-changes-guard";
import { createClientMutationId } from "@/lib/client-id";

type Tab = "library" | "match" | "tier";
// Keep buffered media while the same recording remains in a subsequent round.
const playbackKey = (track: SongTrack) => JSON.stringify([track.id, track.source, track.itunes, track.clipStart, track.clipLength]);
export function SongWorkspace({ boardId, view = "library" }: { boardId: string; view?: Tab }) {
  const router = useRouter();
  const [board, setBoard] = useState<SongBoardView | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const latestBoard = useRef<SongBoardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [login, setLogin] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<SongTrack | "new" | null>(null);
  const [itunesTarget, setItunesTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [year, setYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [renaming, setRenaming] = useState(false);
  const lock = useRef(false);
  const endpoint = `/api/anisong/boards/${boardId}`;
  function navigate(next: Tab) {
    if (lock.current || importing || next === view) return;
    if ((editing || batchOpen || bulkEditing) &&
        !window.confirm("当前歌曲编辑或导入尚未完成，确定离开吗？")) return;
    cancelSongAudioPreload();
    window.dispatchEvent(new CustomEvent("anisong:play", { detail: null }));
    router.push(next === "library" ? "/anisong/" + boardId : "/anisong/" + boardId + "/" + next);
  }
  const reload = useCallback(async () => {
    setLoading(true);
    try { const value = await songRequest<SongBoardView>(endpoint); latestBoard.current = value; setBoard(value); setConflict(false); setError(""); setLogin(false); }
    catch (e) { setError(e instanceof Error ? e.message : "加载失败"); setLogin(e instanceof SongApiError && e.status === 401); }
    finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { setShareUrl(board?.shareToken ? `${window.location.origin}/anisong/share/${board.shareToken}` : ""); }, [board?.shareToken]);
  useEffect(() => () => cancelSongAudioPreload(), []);
  useEffect(() => {
    if (!editing && !batchOpen && !bulkEditing && !busy && !importing) return;
    return registerUnsavedChangesGuard(window, busy || importing ? "操作尚未完成，确定离开吗？" : "编辑或导入面板尚未收起，确定放弃待保存内容并离开吗？");
  }, [editing, batchOpen, bulkEditing, busy, importing]);
  function editTrack(next: SongTrack | "new" | null) {
    if (lock.current || importing) return;
    if (next === editing || (next && next !== "new" && editing && editing !== "new" && next.id === editing.id)) return;
    if ((editing || batchOpen || bulkEditing) && !window.confirm("放弃当前未保存的歌曲编辑？")) return;
    setBatchOpen(false); setBulkEditing(false); setEditing(next);
  }

  async function mutate(input: Record<string, unknown>, form?: FormData): Promise<boolean> {
    const currentBoard = latestBoard.current;
    if (!currentBoard || lock.current || conflict || (importing && !form?.get("importKey"))) return false;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    cancelSongAudioPreload(); window.dispatchEvent(new CustomEvent("anisong:play", { detail: null }));
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
  async function auxiliary<T extends SongBoardView | TemplatePublishResult>(route: "template" | "itunes", input: Record<string, unknown>): Promise<T | null> {
    const current = latestBoard.current;
    if (!current || lock.current || conflict || importing) return null;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    cancelSongAudioPreload(); window.dispatchEvent(new CustomEvent("anisong:play", { detail: null }));
    try {
      const value = await songRequest<SongBoardView | TemplatePublishResult>(`${endpoint}/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, revision: current.revision }) });
      const next = "board" in value ? value.board : value;
      latestBoard.current = next; setBoard(next); setNotice(route === "template" ? "公共曲单已发布" : "iTunes 匹配已保存"); return value as T;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
      if (!(cause instanceof SongApiError) || cause.status === 409 || cause.status >= 500) setConflict(true);
      if (cause instanceof SongApiError && cause.status === 401) setLogin(true);
      return null;
    } finally { lock.current = false; setBusy(false); }
  }

  const ranking = useMemo(() => board ? rankSongs(board.document) : null, [board]);
  const snapshot = useMemo(() => board ? songSnapshot(board.title, board.document) : null, [board]);
  const pair = useMemo(() => board ? nextSongPair(board.document) : null, [board]);
  const visibleTracks = useMemo(() => board?.document.tracks.filter(t =>
    (!kind || t.kind === kind) && (!year || String(t.year) === year) && (!quarter || String(t.quarter) === quarter) &&
    (!search.trim() || [t.title, t.artist, t.anime, ...t.tags].some(s => s.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
  ) ?? [], [board, search, kind, year, quarter]);
  const visibleMatchCount = visibleTracks.filter(t => !ranking?.scores.find(score => score.animeId === t.id)?.isHidden).length;
  const vote = (result: SongDecision) => {
    if (!pair) return;
    void mutate({ action: "vote", eventId: createClientMutationId("song-vote"), leftId: pair.left.id, rightId: pair.right.id, result }).then(saved => {
      const nextBoard = latestBoard.current;
      if (!saved || !nextBoard) return;
      const nextPair = nextSongPair(nextBoard.document);
      if (nextPair) preloadSongAudioPair([nextPair.left, nextPair.right]);
    });
  };
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if (view !== "match" || !pair || busy || conflict || loading || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable=false])")) return;
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
    {view === "match" ? <MatchHeading mode="music" title={board.title} backHref={"/anisong/" + boardId} description="先试听，再选择更喜欢的一首。点击封面或选择按钮会记录对决；播放按钮只负责试听。平局计入比较，跳过不改变评分；未听过的歌曲可在曲单中恢复。"
      context={<span className="text-slate-400">{ranking?.active.length} 首 · {ranking?.progress.effectiveComparisons} 次比较</span>}
      tools={<><span role="status" className="text-xs text-slate-400">{busy ? "正在处理…" : conflict ? "请重新载入" : notice || "进度已保存"}</span><AppButton variant="ghost" size="sm" disabled={disabled || !board.document.events.length} onClick={() => void mutate({ action: "undo" })}>撤回上一步</AppButton></>}
    /> : <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><Link href="/anisong" className="text-sm text-anime-cyan">← ANISONGMATCH</Link><h1 className="mt-2 break-words text-xl font-bold sm:text-2xl">{board.title}</h1><p className="mt-1 text-xs text-slate-400">{board.document.tracks.length} 首歌曲 · {ranking?.active.length} 首参与对决 · {ranking?.progress.effectiveComparisons} 次有效比较</p></div>
      <div className="flex items-center gap-3"><span role="status" className="text-xs text-slate-400">{busy ? "正在处理…" : conflict ? "请重新载入确认进度" : notice || "进度已保存"}</span><AppButton variant="ghost" size="sm" disabled={disabled} onClick={() => setRenaming(!renaming)}>改名</AppButton></div>
    </header>}
    {board.templateId && <p className="text-xs leading-6 text-slate-400">来自<Link href={`/anisong/templates/${board.templateId}`} className="mx-1 text-anime-cyan underline">公共曲单</Link>· 版本 {board.templateRevision} · 你的比较进度与其他玩家独立保存</p>}
    {renaming && <form className="flex gap-3" onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); if (await mutate({ action: "rename", title: data.get("title") })) setRenaming(false); }}><input aria-label="曲单名称" name="title" defaultValue={board.title} maxLength={80} required className="anime-field" /><AppButton type="submit" disabled={disabled}>保存</AppButton></form>}
    {error && <div role="alert" className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-100"><p>{error}</p>{conflict && <><p>当前操作未确认。重新载入已保存进度后即可继续。</p><AppButton size="sm" onClick={() => void reload()} disabled={busy || loading}>重新载入</AppButton></>}{login && <Link href={`/login?next=${encodeURIComponent(`/anisong/${boardId}`)}`} className="underline">重新登录</Link>}</div>}
    {view === "library" && <section aria-label="开始音乐对决" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <div><h2 className="font-bold">准备好就开始对决</h2><p className="mt-1 text-xs text-slate-400">已经选择 {ranking?.active.length ?? 0} 首歌曲。曲单管理与音乐对决分开，不会丢失之前的比较记录。</p></div>
      <div className="flex flex-wrap gap-2"><AppButton disabled={disabled || (ranking?.active.length ?? 0) < 2} onClick={() => navigate("match")}>开始 / 继续音乐对决</AppButton><AppButton variant="secondary" disabled={disabled} onClick={() => navigate("tier")}>我的 Tier List</AppButton></div>
    </section>}
    {view === "tier" && <nav aria-label="音乐榜单导航" className="flex flex-wrap items-center gap-3 text-sm"><Link href={"/anisong/" + boardId} className="text-anime-cyan hover:underline">← 返回曲单</Link><Link href={"/anisong/" + boardId + "/match"} className="text-anime-cyan hover:underline">继续音乐对决 →</Link></nav>}
    {view === "library" && <section aria-label="曲单歌曲管理" className="space-y-5">
      <SongTemplatePublisher board={board} disabled={disabled || Boolean(editing) || batchOpen || bulkEditing} onPublish={confirmed => auxiliary<TemplatePublishResult>("template", { shareAudioConfirmed: confirmed })} />
      {itunesTarget && board.document.tracks.find(t => t.id === itunesTarget) && <SongItunesSearch key={itunesTarget} track={board.document.tracks.find(t => t.id === itunesTarget)} disabled={disabled} onClose={() => setItunesTarget(null)} onSelect={async song => Boolean(await auxiliary<SongBoardView>("itunes", { trackId: itunesTarget, itunesId: song.reference.id, country: song.reference.country }))} onRemove={async () => Boolean(await auxiliary<SongBoardView>("itunes", { trackId: itunesTarget, remove: true }))} />}
      <SongNeteaseSearch tracks={board.document.tracks} disabled={disabled || Boolean(editing) || batchOpen || bulkEditing} onSave={data => mutate({}, data)} />
      <SongItunesSearch disabled={disabled || Boolean(editing) || batchOpen || bulkEditing} onSelect={async (song, data) => { data.set("itunesId", song.reference.id); data.set("itunesCountry", song.reference.country); data.set("title", song.reference.title); data.set("artist", song.reference.artist); data.set("clipStart", "0"); data.set("clipLength", "30"); return mutate({}, data); }} />
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">按季度、类型或风格筛选，再选择参赛范围。</p><div className="flex flex-wrap gap-2"><AppButton variant="ghost" disabled={disabled || batchOpen || board.document.tracks.length >= MAX_TRACKS} onClick={() => { if ((editing || batchOpen || bulkEditing) && !window.confirm("放弃当前未保存的编辑或待导入文件？")) return; setEditing(null); setBulkEditing(false); setBatchOpen(true); }}>批量导入音频</AppButton><AppButton disabled={disabled || board.document.tracks.length >= MAX_TRACKS} onClick={() => editTrack("new")}>＋ 添加歌曲</AppButton></div></div>
      {batchOpen && <SongBatchImport tracks={board.document.tracks} disabled={busy || conflict || loading || login} onRunning={setImporting} onSave={data => mutate({}, data)} onCancel={hasPending => { if (!hasPending || window.confirm("收起导入面板？已保存歌曲会保留，待导入文件需重新选择。")) setBatchOpen(false); }} />}
      {editing && <SongForm boardId={boardId} key={editing === "new" ? "new" : editing.id} track={editing === "new" ? undefined : editing} busy={disabled} onCancel={() => editTrack(null)} onSave={async data => { const saved = await mutate({}, data); if (saved) setEditing(null); return saved; }} />}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <input aria-label="搜索歌曲或风格" placeholder="歌名 / 歌手 / 动画 / 风格" className="anime-field" disabled={bulkEditing || busy || importing} value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="歌曲类型" className="anime-field" disabled={bulkEditing || busy || importing} value={kind} onChange={e => setKind(e.target.value)}><option value="">全部类型</option>{SONG_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select>
        <select aria-label="年份" className="anime-field" disabled={bulkEditing || busy || importing} value={year} onChange={e => setYear(e.target.value)}><option value="">全部年份</option>{[...new Set([...board.document.tracks.map(t => t.year).filter((v): v is number => v !== null), ...(year ? [Number(year)] : [])])].sort((a, b) => b - a).map(y => <option key={y}>{y}</option>)}</select>
        <select aria-label="季度" className="anime-field" disabled={bulkEditing || busy || importing} value={quarter} onChange={e => setQuarter(e.target.value)}><option value="">全部季度</option>{["冬季", "春季", "夏季", "秋季"].map((s, i) => <option key={s} value={i + 1}>{s}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400"><span>筛选结果 {visibleTracks.length} 首 · 可对决 {visibleMatchCount} 首</span>{(search || kind || year || quarter) && <AppButton size="sm" variant="quiet" disabled={disabled || bulkEditing} onClick={() => { setSearch(""); setKind(""); setYear(""); setQuarter(""); }}>清除筛选</AppButton>}</div>
      <div className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">当前参赛范围：{board.document.candidateIds === null ? `全曲单 ${board.document.tracks.length} 首（新加入的歌曲也参赛）` : `自选 ${board.document.candidateIds.length} 首`}<span className="ml-2 text-xs text-slate-400">可对决 {ranking?.active.length ?? 0} 首 · 未听过 {ranking?.hidden.length ?? 0} 首</span></div>
      {(board.document.tracks.length > 0 || bulkEditing) && <SongBulkTools tracks={board.document.tracks} visible={visibleTracks} selectedIds={selectedIds} hiddenIds={ranking?.scores.filter(score => score.isHidden).map(score => score.animeId) ?? []} candidateIds={board.document.candidateIds} disabled={disabled || Boolean(editing) || batchOpen} open={bulkEditing} onOpen={setBulkEditing} onSelection={setSelectedIds}
        onSave={(trackIds, patch) => mutate({ action: "bulkEdit", trackIds, patch })}
        onCandidates={async (trackIds, mode) => { const saved = await mutate(mode === "only" ? { action: "candidates", trackIds } : { action: "candidateSelection", trackIds, mode }); if (saved && mode === "only") navigate("match"); return saved; }} />}
      <div className="flex flex-wrap items-center gap-3"><AppButton variant="secondary" size="sm" disabled={disabled || Boolean(editing) || batchOpen || bulkEditing || visibleMatchCount < 2} onClick={async () => { if (await mutate({ action: "candidates", trackIds: visibleTracks.map(t => t.id) })) navigate("match"); }}>用筛选的 {visibleTracks.length} 首开始对决</AppButton>{board.document.candidateIds !== null && <AppButton variant="ghost" size="sm" disabled={disabled || bulkEditing} onClick={() => void mutate({ action: "candidates", trackIds: null })}>恢复全曲单参赛</AppButton>}<span className="text-xs text-slate-500">分档仅使用参赛歌曲之间的比较；切换范围保留历史。</span></div>
      {visibleTracks.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center"><p className="text-lg font-semibold">{board.document.tracks.length ? "没有符合筛选的歌曲" : "把舍不得跳过的歌放进来"}</p><p className="mt-1 text-xs text-slate-400">{board.document.tracks.length ? "试试其他季度、类型或关键词。" : "添加至少两首歌曲，就能开始第一场对决。"}</p></div> : <div className="grid gap-3 sm:grid-cols-2">
        {visibleTracks.map(track => {
          const score = ranking?.scores.find(s => s.animeId === track.id);
          const excluded = board.document.candidateIds !== null && !board.document.candidateIds.includes(track.id);
          return <article key={playbackKey(track)} className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-slate-950/30 p-5">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-slate-300"><input type="checkbox" aria-label={`选择歌曲：${track.title}`} checked={selectedIds.includes(track.id)} disabled={disabled || bulkEditing || Boolean(editing) || batchOpen} className="h-4 w-4 accent-teal-300" onChange={e => setSelectedIds(previous => e.target.checked ? [...new Set([...previous, track.id])] : previous.filter(id => id !== track.id))} />选择歌曲</label>
            <div className="flex items-start gap-3"><SongCover src={track.coverUrl} title={track.title} className="w-20" /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{track.title}</h3><p className="mt-1 break-words text-sm text-slate-400">{track.artist || "歌手未填写"}</p></div><span className="rounded-md bg-anime-purple/10 px-2 py-1 text-xs text-anime-purple">{KIND_LABELS[track.kind]}</span></div>
            <p className="break-words text-xs text-slate-400">{[track.anime, track.year, track.quarter ? ["冬季", "春季", "夏季", "秋季"][track.quarter - 1] : "", ...track.tags].filter(Boolean).join(" · ") || "可在编辑中补充动画、季度和风格"}</p>
            <SongPlayer track={track} boardId={boardId} />
            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
              <span className="mr-auto text-xs text-slate-500">{excluded ? "未参赛" : score?.isHidden ? "未听过" : `已比较 ${score?.compareCount ?? 0} 次`}</span>
              {score?.isHidden && <AppButton size="sm" variant="ghost" disabled={disabled || bulkEditing} onClick={() => void mutate({ action: "restore", trackId: track.id })}>恢复</AppButton>}
              <AppButton size="sm" variant="ghost" disabled={disabled} onClick={() => { editTrack(track); window.scrollTo({ top: 0, behavior: "smooth" }); }}>编辑</AppButton>
              <AppButton size="sm" variant="ghost" disabled={disabled || Boolean(editing) || batchOpen || bulkEditing} onClick={() => { setItunesTarget(track.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{track.itunes ? "修改 iTunes 匹配" : "匹配 iTunes 备用源"}</AppButton>
              <AppButton size="sm" variant="ghost" disabled={disabled || bulkEditing} onClick={() => { if (window.confirm(`移除「${track.title}」及与它相关的对决记录？榜单将重新计算。`)) void mutate({ action: "remove", trackId: track.id }); }}>移除</AppButton>
            </div>
          </article>;
        })}
      </div>}
      <div className="border-t border-white/10 pt-5"><AppButton variant="quiet" size="sm" disabled={disabled || Boolean(editing) || batchOpen || bulkEditing} onClick={() => void removeBoard()}>删除这份曲单</AppButton></div>
    </section>}
    {view === "match" && ranking && <SongMatchPanel boardId={boardId} pair={pair} ranking={ranking} disabled={disabled} onVote={vote} onLibrary={() => navigate("library")} onTier={() => navigate("tier")} />}
    {view === "tier" && snapshot && <SongTierPanel board={board} snapshot={snapshot} disabled={disabled} shareUrl={shareUrl} onTier={(trackId, tier) => void mutate({ action: "tier", trackId, tier })} onExportPng={() => void exportPng()} onPublish={() => void mutate({ action: "publish" })} onUnpublish={() => void mutate({ action: "unpublish" })} onNotice={setNotice} onError={setError} />}
  </div>;
}
