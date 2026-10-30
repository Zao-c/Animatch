"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/AppButton";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import type { SongBoardView, SongTemplateView } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
export function SongTemplateGallery() {
  const router = useRouter();
  const [templates, setTemplates] = useState<SongTemplateView[]>([]), [query, setQuery] = useState(""), [search, setSearch] = useState("");
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [starting, setStarting] = useState<string | null>(null); const lock = useRef(false);
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError("");
    try { const data = await songRequest<{ templates: SongTemplateView[]; hasMore: boolean }>(`/api/anisong/templates?q=${encodeURIComponent(search)}&page=${page}`, { signal }); if (!signal.aborted) { setTemplates(data.templates); setMore(data.hasMore); } }
    catch (cause) { if (!signal.aborted) setError(cause instanceof Error ? cause.message : "公共曲单加载失败"); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [search, page]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function start(template: SongTemplateView) {
    if (lock.current) return; lock.current = true; setStarting(template.id); setError("");
    try { const board = await songRequest<SongBoardView>(`/api/anisong/templates/${template.id}/start`, { method: "POST" }); router.push(`/anisong/${board.id}?view=match`); }
    catch (cause) { if (cause instanceof SongApiError && cause.status === 401) router.push(`/login?next=${encodeURIComponent(`/anisong/templates/${template.id}`)}`); else setError(cause instanceof Error ? cause.message : "开始失败"); }
    finally { lock.current = false; setStarting(null); }
  }
  return <section className="space-y-5" aria-label="公共音乐曲单">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs tracking-widest text-anime-cyan">PICK A PLAYLIST</p><h2 className="mt-2 text-2xl font-bold">选一份曲单，直接开始</h2><p className="mt-2 text-sm leading-6 text-slate-400">歌曲和封面由创建者准备。无需网易云账号；公共音频池与 iTunes 可切换，每个人保存自己的 Tier List。</p></div><form onSubmit={event => { event.preventDefault(); setPage(0); setSearch(query.trim()); }} className="flex w-full gap-2 sm:w-auto"><input aria-label="搜索公共曲单" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="季度、类型或曲单名称" className="anime-field min-w-0 flex-1" /><AppButton type="submit" variant="secondary" disabled={loading}>查找</AppButton></form></div>
    {error && <p role="alert" className="rounded-xl border border-amber-300/20 p-3 text-sm text-amber-200">{error}</p>}
    {loading ? <p role="status" className="py-8 text-sm text-slate-400">正在加载公共曲单…</p> : templates.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map(template => <article key={template.id} className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <Link href={`/anisong/templates/${template.id}`} className="flex items-start gap-4"><div className="grid w-28 shrink-0 grid-cols-2 gap-1">{[0, 1, 2, 3].map(index => <SongCover key={index} src={template.covers[index]} title={template.title} className="w-full !rounded-md" />)}</div><div className="min-w-0"><h3 className="break-words font-bold leading-6">{template.title}</h3><p className="mt-2 text-xs text-slate-400">{template.trackCount} 首 · 可试听 {template.playableCount} 首 · v{template.revision}</p><p className="mt-2 truncate text-xs text-slate-500">创建者：{template.ownerName}</p></div></Link>
      <p className="my-4 text-xs text-slate-400">公共池 {template.poolCount} 首 · iTunes {template.itunesCount} 首</p>
      <AppButton className="mt-auto" disabled={Boolean(starting)} onClick={() => void start(template)}>{starting === template.id ? "正在准备…" : "开始 / 继续我的对决"}</AppButton>
      <div className="mt-3 flex min-h-8 items-center justify-between gap-3 text-xs"><Link href={`/anisong/templates/${template.id}`} className="text-slate-400 underline">查看曲目与音源</Link>{template.mine && <button type="button" disabled={Boolean(starting)} className="text-slate-500 hover:text-amber-200" onClick={async () => { if (!window.confirm("从公共列表下架这份曲单？已开始的个人进度和公共音频会保留。")) return; try { await songRequest(`/api/anisong/templates/${template.id}`, { method: "DELETE" }); setTemplates(current => current.filter(t => t.id !== template.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "下架失败"); } }}>下架我的曲单</button>}</div>
    </article>)}</div> : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-sm leading-7 text-slate-400">{search ? "没有找到匹配的公共曲单，试试其他名称。" : "公共曲单还在准备中。创建音乐曲单、补充音频并发布后，大家就能直接选来玩。"}</div>}
    {(page > 0 || more) && <div className="flex items-center justify-center gap-4"><AppButton size="sm" variant="ghost" disabled={loading || page === 0} onClick={() => setPage(current => current - 1)}>上一页</AppButton><span className="text-xs text-slate-400">第 {page + 1} 页</span><AppButton size="sm" variant="ghost" disabled={loading || !more} onClick={() => setPage(current => current + 1)}>下一页</AppButton></div>}
  </section>;
}
