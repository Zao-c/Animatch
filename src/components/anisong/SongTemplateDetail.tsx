"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { DashboardTabs } from "@/components/ui/DashboardTabs";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import { KIND_LABELS, SONG_KINDS, type SongKind, type SongBoardView, type SongDocument, type SongTemplateView } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongPlayer } from "./SongPlayer";
import { SongShareButton } from "./SongShareButton";
import { SongCommunityRanking } from "./SongCommunityRanking";

const SONGS_PER_PAGE = 12;
type PublicTab = "songs" | "range" | "community";
type PublicTemplate = SongTemplateView & { document: SongDocument };

export function SongTemplateDetail({ templateId }: { templateId: string }) {
  const router = useRouter(), lock = useRef(false), wallRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<PublicTemplate | null>(null);
  const [tab, setTab] = useState<PublicTab>("songs");
  const pendingTabScroll = useRef(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [query, setQuery] = useState(""), [kind, setKind] = useState<"" | SongKind>("");
  const [page, setPage] = useState(0), [selectedIds, setSelectedIds] = useState<string[]>([]), [rangeTouched, setRangeTouched] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    songRequest<PublicTemplate>(`/api/anisong/templates/${templateId}`, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setTemplate(data);
        setSelectedIds(data.document.tracks.map(track => track.id));
        setRangeTouched(false);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "加载失败"); });
    return () => controller.abort();
  }, [templateId, retryKey]);

  const tracks = useMemo(() => template?.document.tracks ?? [], [template]);
  const filteredTracks = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return tracks.filter(track =>
      (!kind || track.kind === kind) &&
      (!search || [track.title, track.artist, track.anime, String(track.year ?? ""), ...track.tags].join(" ").toLocaleLowerCase().includes(search))
    );
  }, [tracks, query, kind]);
  const pages = Math.max(1, Math.ceil(filteredTracks.length / SONGS_PER_PAGE));
  const currentPage = Math.min(page, pages - 1);
  const pageTracks = filteredTracks.slice(currentPage * SONGS_PER_PAGE, (currentPage + 1) * SONGS_PER_PAGE);
  const selected = new Set(selectedIds);
  const canParticipate = template && selectedIds.length >= 2;
  const isCreator = Boolean(template?.mine && template.ownerBoardId);

  function goToSongsPage(next: number) {
    setPage(Math.max(0, Math.min(pages - 1, next)));
    window.requestAnimationFrame(() => wallRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function changeFilter(next: { query?: string; kind?: "" | SongKind }) {
    if (next.query !== undefined) setQuery(next.query);
    if (next.kind !== undefined) setKind(next.kind);
    setPage(0);
  }
  useEffect(() => {
    if (!pendingTabScroll.current) return;
    pendingTabScroll.current = false;
    wallRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tab]);

  function selectTab(next: PublicTab) {
    if (tab === next) {
      wallRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    pendingTabScroll.current = true;
    setTab(next);
    setPage(0);
  }
  function selectAll() { setSelectedIds(tracks.map(track => track.id)); setRangeTouched(true); }
  function onlyFiltered() { setSelectedIds(filteredTracks.map(track => track.id)); setRangeTouched(true); }
  function toggleTrack(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    setRangeTouched(true);
  }
  async function start() {
    if (lock.current || !canParticipate) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const board = await songRequest<SongBoardView>(`/api/anisong/templates/${templateId}/start`, {
        method: "POST",
        ...(rangeTouched ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateIds: selectedIds }) } : {})
      });
      router.push(`/anisong/${board.id}/match`);
    } catch (cause) {
      if (cause instanceof SongApiError && cause.status === 401)
        router.push(`/login?next=${encodeURIComponent(`/anisong/templates/${templateId}`)}`);
      else setError(cause instanceof Error ? cause.message : "开始对决失败");
    } finally { lock.current = false; setBusy(false); }
  }

  const ownerHref = isCreator ? `/anisong/${template!.ownerBoardId}` : "";
  return <div className="mx-auto w-full max-w-[90rem] space-y-4">
    <Link href="/anisong" className="inline-flex min-h-9 items-center text-sm text-anime-cyan">← 公开曲单</Link>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/25 p-3 text-sm text-amber-200"><span>{error}</span>{!template && <AppButton variant="ghost" size="sm" onClick={() => setRetryKey(value => value + 1)}>重试加载</AppButton>}</div>}
    {!template ? !error && <p role="status">正在加载曲单…</p> : <>
      <header className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(310px,430px)]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <AppBadge tone="success">公开</AppBadge>
            {template.mine && <AppBadge tone="status">我创建的</AppBadge>}
            <AppBadge>{template.trackCount} 首歌曲</AppBadge>
          </div>
          <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl">{template.title}</h1>
          <p className="text-sm text-slate-400">由 {template.ownerName} 创建</p>
        </div>
        <AppCard variant="focus" className="space-y-2 p-3">
          {isCreator ?
            <Link href={template.trackCount >= 2 ? `${ownerHref}/match` : ownerHref} className={appButtonClasses({ variant: "primary", size: "lg", className: "w-full" })}>
              {template.trackCount >= 2 ? "继续我的对决" : "添加歌曲"}
            </Link> :
            <AppButton variant="primary" size="lg" className="w-full" disabled={busy || !canParticipate} onClick={() => void start()}>
              {busy ? "正在进入…" : "开始 / 继续对决"}
            </AppButton>}
          <div className="grid grid-cols-2 gap-2">
            <AppButton variant="secondary" size="sm" onClick={() => selectTab("range")}>
              {isCreator ? "查看参赛范围" : "选择参赛范围"}
            </AppButton>
            <SongShareButton path={`/anisong/templates/${templateId}`} />
          </div>
          {isCreator && <Link href={ownerHref} className="block py-1 text-center text-xs text-anime-cyan">管理我的曲单 →</Link>}
        </AppCard>
      </header>
      <div ref={wallRef} className="scroll-mt-24">
        <DashboardTabs id="song-public" label="公共曲单导航" value={tab} onChange={selectTab}
          items={[{ value: "songs", label: "歌曲谱" }, { value: "range", label: "参赛范围" }, { value: "community", label: "社区榜" }]} />
      </div>
      {tab === "community" ? <AppCard id={`song-public-panel-${tab}`} role="tabpanel" aria-labelledby={`song-public-tab-${tab}`} className="p-4 sm:p-5"><SongCommunityRanking templateId={templateId}/></AppCard> :
        <AppCard id={`song-public-panel-${tab}`} role="tabpanel" aria-labelledby={`song-public-tab-${tab}`} className="space-y-4 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="sr-only">{tab === "range" ? "参赛范围" : "歌曲谱"}</h2>
            {tab === "range" ? <span className="text-xs text-slate-400">{selectedIds.length} / {tracks.length} 首</span> : (query || kind) ? <span className="text-xs text-slate-400">{filteredTracks.length} 首结果</span> : null}
          </div>
          {tab === "range" && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-anime-cyan/20 bg-anime-cyan/[0.04] p-3">
            {isCreator ?
              <Link href={`${ownerHref}?tab=range`} className={appButtonClasses({ variant: "secondary", size: "sm" })}>调整我的参赛范围</Link> :
              <><AppButton size="sm" variant="ghost" onClick={selectAll}>全选</AppButton>
                <AppButton size="sm" variant="ghost" disabled={filteredTracks.length < 2} onClick={onlyFiltered}>仅使用筛选结果</AppButton>
                <AppButton size="sm" variant="quiet" onClick={() => { setSelectedIds([]); setRangeTouched(true); }}>清空</AppButton></>}
          </div>}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
            <input aria-label="搜索歌曲、歌手或所属动画" type="search" placeholder="搜索歌名、歌手、动画…" className="anime-field min-w-0"
              value={query} onChange={event => changeFilter({ query: event.target.value })}/>
            <select aria-label="筛选歌曲类型" className="anime-field min-h-10" value={kind} onChange={event => changeFilter({ kind: event.target.value as "" | SongKind })}>
              <option value="">全部类型</option>{SONG_KINDS.map(item => <option value={item} key={item}>{KIND_LABELS[item]}</option>)}
            </select>
            {(query || kind) && <AppButton variant="ghost" size="sm" onClick={() => changeFilter({ query: "", kind: "" })}>清除</AppButton>}
          </div>
          {filteredTracks.length ? <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {pageTracks.map(track => {
              const playable = track.source.kind === "pool" || track.source.kind === "itunes" || Boolean(track.itunes);
              return <article key={track.id} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/25">
                <div className="relative">
                  <SongCover src={track.coverUrl} title={track.title} className="w-full !rounded-none !border-0" />
                  {tab === "range" && !isCreator && <label className="absolute left-2 top-2 flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-slate-950/90 px-2 text-xs text-white">
                    <input type="checkbox" className="h-4 w-4 accent-teal-300" aria-label={`选择参赛：${track.title}`} checked={selected.has(track.id)} onChange={() => toggleTrack(track.id)} />
                    参赛
                  </label>}
                </div>
                <div className="space-y-1.5 p-2.5">
                  <h3 title={track.title} className="line-clamp-2 min-h-9 break-words text-xs font-bold leading-4">{track.title}</h3>
                  <p title={track.anime || "动画来源未填写"} className="line-clamp-2 min-h-7 break-words text-[11px] leading-4 text-cyan-100">{track.anime || "动画来源未填写"} · {KIND_LABELS[track.kind]}</p>
                  <p className="truncate text-[11px] text-slate-400" title={track.artist}>{track.artist || "歌手未填写"}</p>
                  {playable ? <SongPlayer track={track} boardId="" templateId={templateId} minimal /> :
                    <p className="py-2 text-[11px] text-slate-500">暂无试听</p>}
                </div>
              </article>;
            })}
          </div> : <p className="rounded-xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-400">没有符合条件的歌曲</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <span role="status" className="text-xs text-slate-400">{filteredTracks.length ? `${currentPage * SONGS_PER_PAGE + 1}–${Math.min((currentPage + 1) * SONGS_PER_PAGE, filteredTracks.length)} / ${filteredTracks.length} 首` : "0 首"} · 第 {currentPage + 1} / {pages} 页</span>
            <div className="flex gap-2">
              <AppButton variant="ghost" size="sm" disabled={currentPage === 0} onClick={() => goToSongsPage(currentPage - 1)}>上一页</AppButton>
              <AppButton variant="ghost" size="sm" disabled={currentPage >= pages - 1} onClick={() => goToSongsPage(currentPage + 1)}>下一页</AppButton>
            </div>
          </div>
          {tab === "range" && !isCreator && <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <p role="status" className="text-xs text-slate-300">已选择 {selectedIds.length} 首（至少 2 首）</p>
            <AppButton variant="primary" disabled={busy || !canParticipate} onClick={() => void start()}>{busy ? "正在保存…" : "用已选歌曲开始对决"}</AppButton>
          </div>}
        </AppCard>}
    </>}
  </div>;
}
