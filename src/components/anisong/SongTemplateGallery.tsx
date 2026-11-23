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
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(""), [actionError, setActionError] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const lock = useRef(false);
  const galleryRef = useRef<HTMLElement>(null);
  const scrollAfterPage = useRef(false);
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setLoadError("");
    try {
      const data = await songRequest<{ templates: SongTemplateView[]; hasMore: boolean }>(`/api/anisong/templates?q=${encodeURIComponent(search)}&page=${page}`, { signal });
      if (!signal.aborted) { setTemplates(data.templates); setMore(data.hasMore); }
    } catch (cause) { if (!signal.aborted) setLoadError(cause instanceof Error ? cause.message : "公共曲单加载失败"); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [search, page]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, retryKey]);
  // Keep the reader inside the music gallery when changing pages. Scrolling
  // straight to window.top loses the gallery under the site's main header.
  useEffect(() => {
    if (loading || !scrollAfterPage.current) return;
    scrollAfterPage.current = false;
    galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);
  function goToPage(next: number) {
    scrollAfterPage.current = true;
    setPage(Math.max(0, next));
  }

  async function start(template: SongTemplateView) {
    if (lock.current) return;
    lock.current = true; setStarting(template.id); setActionError("");
    try {
      const board = await songRequest<SongBoardView>(`/api/anisong/templates/${template.id}/start`, { method: "POST" });
      router.push(`/anisong/${board.id}/match`);
    } catch (cause) {
      if (cause instanceof SongApiError && cause.status === 401) router.push(`/login?next=${encodeURIComponent(`/anisong/templates/${template.id}`)}`);
      else setActionError(cause instanceof Error ? cause.message : "开始失败");
    } finally { lock.current = false; setStarting(null); }
  }
  return <section ref={galleryRef} className="scroll-mt-24 space-y-4" aria-label="公共音乐曲单">
    <div className="flex justify-end">
      <h2 className="sr-only">公开曲单</h2>
      <form role="search" onSubmit={event => { event.preventDefault(); setPage(0); setSearch(query.trim()); }} className="flex w-full min-w-0 gap-2 sm:max-w-md">
        <input aria-label="搜索公共曲单" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="曲单名称、季度、类型" className="anime-field min-w-0 flex-1" />
        <AppButton type="submit" variant="secondary" disabled={loading}>搜索</AppButton>
      </form>
    </div>
    {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/20 p-3 text-sm text-amber-200"><span>{loadError}</span><AppButton variant="ghost" size="sm" onClick={() => setRetryKey(value => value + 1)}>重试加载</AppButton></div>}
    {actionError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/20 p-3 text-sm text-amber-200"><span>{actionError}</span><AppButton variant="ghost" size="sm" onClick={() => setActionError("")}>关闭</AppButton></div>}
    {loading ? <p role="status" className="py-8 text-sm text-slate-400">正在加载公开音乐曲单…</p> : loadError ? null : templates.length ?
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map(template =>
        <SongPlaylistCard key={template.id} title={template.title} href={`/anisong/templates/${template.id}`} covers={template.covers}
          count={template.trackCount} playable={template.playableCount} tag={template.mine ? "我创建的" : undefined}>
          <p className="truncate text-xs text-slate-400">{template.ownerName}</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/anisong/templates/${template.id}`} aria-label={`查看曲单：${template.title}`}
              className={appButtonClasses({ variant: "secondary", size: "sm", className: "min-w-0 px-2" })}>查看曲单</Link>
            {template.mine && template.ownerBoardId ?
              <Link href={template.trackCount >= 2 ? `/anisong/${template.ownerBoardId}/match` : `/anisong/${template.ownerBoardId}`}
                className={appButtonClasses({ variant: "primary", size: "sm", className: "min-w-0 px-2" })}>
                {template.trackCount >= 2 ? "进入对决" : "完善曲单"}
              </Link> :
              <AppButton variant="primary" size="sm" className="min-w-0 px-2" disabled={Boolean(starting) || template.trackCount < 2}
                onClick={() => void start(template)}>{starting === template.id ? "正在准备…" : "进入对决"}</AppButton>}
          </div>
          <details className="text-xs text-slate-400">
            <summary className="flex min-h-11 cursor-pointer items-center px-1 font-semibold hover:text-white">更多操作</summary>
            <div className="space-y-3 border-t border-white/10 pb-2 pt-3">
              <p className="text-xs text-slate-400">公共音源 {template.poolCount} · iTunes {template.itunesCount}</p>
              <SongShareButton path={`/anisong/templates/${template.id}`} label="复制曲单链接"/>
              {template.mine && <button type="button" disabled={Boolean(starting)} className="block min-h-9 text-xs text-rose-200 hover:underline" onClick={async () => {
                if (!window.confirm("从公共列表下架这份曲单？已开始的个人进度和公共音频会保留。")) return;
                try { await songRequest(`/api/anisong/templates/${template.id}`, { method: "DELETE" }); setTemplates(current => current.filter(value => value.id !== template.id)); }
                catch (cause) { setActionError(cause instanceof Error ? cause.message : "下架失败"); }
              }}>设为私人／下架</button>}
            </div>
          </details>
        </SongPlaylistCard>)}</div> :
      <div className="rounded-2xl border border-dashed border-white/15 p-8 text-sm leading-7 text-slate-400">{page > 0 ? "当前页没有曲单，可返回上一页。" : search ? "没有找到匹配的公开曲单。" : "暂无公开音乐曲单。"}<Link className="ml-2 text-anime-cyan underline" href="/anisong/create">创建一份曲单 →</Link></div>}
    {loadError && page > 0 && <AppButton size="sm" variant="ghost" onClick={() => goToPage(page - 1)}>返回上一页</AppButton>}
    {!loadError && (page > 0 || more) && <div className="flex items-center justify-center gap-3">
      <AppButton size="sm" variant="ghost" disabled={loading || page === 0} onClick={() => goToPage(page - 1)}>上一页</AppButton>
      <span className="text-xs text-slate-400">第 {page + 1} 页</span>
      <AppButton size="sm" variant="ghost" disabled={loading || !more} onClick={() => goToPage(page + 1)}>下一页</AppButton>
    </div>}
  </section>;
}
