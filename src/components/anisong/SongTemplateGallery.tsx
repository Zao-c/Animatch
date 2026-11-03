"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import type { SongBoardView, SongTemplateView } from "@/lib/anisong/types";
import { SongPlaylistCard } from "./SongPlaylistCard";
import { SongShareButton } from "./SongShareButton";

export function SongTemplateGallery() {
  const router = useRouter();
  const [templates, setTemplates] = useState<SongTemplateView[]>([]);
  const [query, setQuery] = useState(""), [search, setSearch] = useState("");
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const lock = useRef(false);
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const data = await songRequest<{ templates: SongTemplateView[]; hasMore: boolean }>(`/api/anisong/templates?q=${encodeURIComponent(search)}&page=${page}`, { signal });
      if (!signal.aborted) { setTemplates(data.templates); setMore(data.hasMore); }
    } catch (cause) { if (!signal.aborted) setError(cause instanceof Error ? cause.message : "公共曲单加载失败"); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [search, page]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  async function start(template: SongTemplateView) {
    if (lock.current) return;
    lock.current = true; setStarting(template.id); setError("");
    try {
      const board = await songRequest<SongBoardView>(`/api/anisong/templates/${template.id}/start`, { method: "POST" });
      router.push(`/anisong/${board.id}?view=match`);
    } catch (cause) {
      if (cause instanceof SongApiError && cause.status === 401) router.push(`/login?next=${encodeURIComponent(`/anisong/templates/${template.id}`)}`);
      else setError(cause instanceof Error ? cause.message : "开始失败");
    } finally { lock.current = false; setStarting(null); }
  }
  return <section className="space-y-4" aria-label="公共音乐曲单">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[11px] font-bold tracking-[0.16em] text-anime-cyan">PUBLIC MUSIC PLAYLISTS</p><h2 className="mt-1 text-xl font-bold">公开曲单</h2></div>
      <form onSubmit={event => { event.preventDefault(); setPage(0); setSearch(query.trim()); }} className="flex w-full gap-2 sm:w-auto">
        <input aria-label="搜索公共曲单" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="曲单名称、季度、类型" className="anime-field min-w-0 flex-1" />
        <AppButton type="submit" variant="secondary" disabled={loading}>搜索</AppButton>
      </form>
    </div>
    {error && <p role="alert" className="rounded-xl border border-amber-300/20 p-3 text-sm text-amber-200">{error}</p>}
    {loading ? <p role="status" className="py-8 text-sm text-slate-400">正在加载公开音乐曲单…</p> : templates.length ?
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map(template =>
        <SongPlaylistCard key={template.id} title={template.title} href={`/anisong/templates/${template.id}`} covers={template.covers}
          count={template.trackCount} playable={template.playableCount} tag={template.mine ? "我创建的" : "公开"}>
          <p className="truncate text-xs text-slate-400">创建者：{template.ownerName}{template.mine ? " · 我创建的" : ""}</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/anisong/templates/${template.id}`} className={appButtonClasses({ variant: "ghost", size: "sm", className: "w-full px-2" })}>曲单详情</Link>
            {template.mine && template.ownerBoardId ?
              <Link href={template.trackCount >= 2 ? `/anisong/${template.ownerBoardId}/match` : `/anisong/${template.ownerBoardId}`}
                className={appButtonClasses({ variant: "primary", size: "sm", className: "w-full px-2" })}>
                {template.trackCount >= 2 ? "继续我的对决" : "完善曲单"}
              </Link> :
              <AppButton variant="primary" size="sm" className="w-full px-2" disabled={Boolean(starting) || template.trackCount < 2}
                onClick={() => void start(template)}>{starting === template.id ? "正在准备…" : "个人自由对决"}</AppButton>}
          </div>
          <details className="rounded-xl border border-white/10 bg-slate-950/20 px-3 py-1.5">
            <summary className="flex min-h-9 cursor-pointer items-center text-xs font-semibold text-slate-300">更多操作</summary>
            <div className="space-y-3 border-t border-white/10 pb-2 pt-3">
              <p className="text-xs text-slate-400">公共池 {template.poolCount} 首 · iTunes {template.itunesCount} 首 · v{template.revision}</p>
              <SongShareButton path={`/anisong/templates/${template.id}`} label="复制曲单链接"/>
              {template.mine && <button type="button" disabled={Boolean(starting)} className="block min-h-9 text-xs text-rose-200 hover:underline" onClick={async () => {
                if (!window.confirm("从公共列表下架这份曲单？已开始的个人进度和公共音频会保留。")) return;
                try { await songRequest(`/api/anisong/templates/${template.id}`, { method: "DELETE" }); setTemplates(current => current.filter(value => value.id !== template.id)); }
                catch (cause) { setError(cause instanceof Error ? cause.message : "下架失败"); }
              }}>设为私人／下架</button>}
            </div>
          </details>
        </SongPlaylistCard>)}</div> :
      <div className="rounded-2xl border border-dashed border-white/15 p-8 text-sm leading-7 text-slate-400">{search ? "没有找到匹配的公开曲单。" : "暂无公开音乐曲单。"}<Link className="ml-2 text-anime-cyan underline" href="/anisong/create">创建一份曲单 →</Link></div>}
    {(page > 0 || more) && <div className="flex items-center justify-center gap-3">
      <AppButton size="sm" variant="ghost" disabled={loading || page === 0} onClick={() => setPage(current => current - 1)}>上一页</AppButton>
      <span className="text-xs text-slate-400">第 {page + 1} 页</span>
      <AppButton size="sm" variant="ghost" disabled={loading || !more} onClick={() => setPage(current => current + 1)}>下一页</AppButton>
    </div>}
  </section>;
}
