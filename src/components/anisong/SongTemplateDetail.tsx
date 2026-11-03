"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/AppButton";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import { KIND_LABELS, type SongBoardView, type SongDocument, type SongTemplateView } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongShareButton } from "./SongShareButton";
import { SongCommunityRanking } from "./SongCommunityRanking";
import { SongPlaybackPreferences } from "./SongPlaybackPreferences";

export function SongTemplateDetail({ templateId }: { templateId: string }) {
  const router = useRouter(); const lock = useRef(false);
  const [template, setTemplate] = useState<(SongTemplateView & { document: SongDocument; ownerBoardId?: string | null }) | null>(null);
  const [tab, setTab] = useState<"songs" | "community">("songs");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); songRequest<NonNullable<typeof template>>(`/api/anisong/templates/${templateId}`, { signal: controller.signal }).then(setTemplate).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }); return () => controller.abort(); }, [templateId]);
  async function start() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const board = await songRequest<SongBoardView>(`/api/anisong/templates/${templateId}/start`, { method: "POST" }); router.push(`/anisong/${board.id}?view=match`); }
    catch (cause) { if (cause instanceof SongApiError && cause.status === 401) router.push(`/login?next=${encodeURIComponent(`/anisong/templates/${templateId}`)}`); else setError(cause instanceof Error ? cause.message : "开始失败"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mx-auto w-full max-w-[90rem] space-y-5">
    <Link href="/anisong" className="text-sm text-anime-cyan">← 公开音乐曲单</Link>
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    {!template ? !error && <p role="status">正在加载曲单…</p> : <>
      <header className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,540px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2"><AppBadge tone="success">公开</AppBadge>{template.mine && <AppBadge tone="status">我创建的</AppBadge>}<AppBadge>{template.trackCount} 首歌曲</AppBadge><AppBadge tone="source">音乐</AppBadge><AppBadge>{template.playableCount} 首可试听</AppBadge></div>
          <h1 className="mt-3 break-words text-3xl font-black tracking-tight text-white sm:text-4xl">{template.title}</h1>
          <p className="mt-3 text-sm text-slate-400">由 {template.ownerName} 创建 · 版本 {template.revision} · 参加后独立保存个人对决进度</p>
        </div>
        <AppCard variant="focus" className="p-3">
          <section className="rounded-xl border border-anime-cyan/35 bg-anime-cyan/[0.06] p-3">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-cyan-100">个人音乐对决</h2><span className="text-xs text-slate-400">{template.trackCount} 首歌曲</span></div>
            <AppButton variant="primary" size="lg" className="w-full" disabled={busy || template.trackCount < 2} onClick={() => void start()}>{busy ? "正在准备…" : template.trackCount < 2 ? "至少两首歌曲后可参加" : "开始 / 继续个人对决"}</AppButton>
          </section>
          <div className="mt-3 grid grid-cols-2 gap-3"><AppButton variant="secondary" onClick={() => setTab("community")}>查看社区榜</AppButton><SongShareButton path={`/anisong/templates/${templateId}`} /></div>
          {template.mine && template.ownerBoardId && <Link className="mt-3 block rounded-xl border border-white/10 py-2 text-center text-sm font-semibold text-slate-200 hover:bg-white/5" href={`/anisong/${template.ownerBoardId}`}>管理我创建的曲单</Link>}
          <p className="mt-3 text-center text-xs text-slate-400">分享曲单只复制网址，不会发布或分享音频</p>
        </AppCard>
      </header>
      <nav role="tablist" aria-label="公共曲单导航" className="flex gap-1 rounded-2xl border border-anime-border bg-anime-panel p-1.5">
        <button type="button" role="tab" aria-selected={tab === "songs"} onClick={() => setTab("songs")} className={"min-h-11 rounded-xl px-4 text-sm font-semibold " + (tab === "songs" ? "bg-anime-purple/20 text-purple-100" : "text-slate-300")}>歌曲谱 {template.trackCount}</button>
        <button type="button" role="tab" aria-selected={tab === "community"} onClick={() => setTab("community")} className={"min-h-11 rounded-xl px-4 text-sm font-semibold " + (tab === "community" ? "bg-anime-purple/20 text-purple-100" : "text-slate-300")}>社区榜</button>
      </nav>
      {tab === "songs" ? <AppCard className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold tracking-widest text-cyan-200/70">SONG LIBRARY</p><h2 className="mt-1 text-xl font-bold">歌曲谱</h2></div><details className="relative"><summary className="min-h-10 cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300">试听来源设置</summary><div className="absolute right-0 z-20 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-slate-950 p-3 shadow-xl"><SongPlaybackPreferences /></div></details></div>
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {template.document.tracks.map(track => <article key={track.id} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
            <SongCover src={track.coverUrl} title={track.title} className="w-full !rounded-none !border-0" />
            <div className="space-y-1.5 p-3">
              <h3 title={track.title} className="line-clamp-2 min-h-9 break-words text-xs font-bold sm:text-sm">{track.title}</h3>
              <p className="line-clamp-2 text-xs text-cyan-100">{track.anime || "动画来源未填写"} · {KIND_LABELS[track.kind]}</p>
              <p className="truncate text-xs text-slate-400">{track.artist || "歌手未填写"}</p>
              <p className="text-[10px] text-slate-500">{track.source.kind === "pool" || track.itunes || track.source.kind === "itunes" ? "可试听" : "暂无公共试听音源"}</p>
            </div>
          </article>)}
        </div>
        {!template.document.tracks.length && <p className="p-8 text-center text-sm text-slate-400">创建者还没有添加歌曲，稍后再来看看。</p>}
        <p className="text-xs text-slate-500">打开个人对决后才能使用曲单里的试听源；未公开的上传音频不会对外提供。</p>
      </AppCard> : <AppCard className="p-4 sm:p-5"><SongCommunityRanking templateId={templateId} /></AppCard>}
    </>}
  </div>;
}
