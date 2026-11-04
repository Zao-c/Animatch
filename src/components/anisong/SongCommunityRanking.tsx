"use client";
import { useEffect, useState } from "react";
import { songRequest } from "@/lib/anisong/client";
import { SongCover } from "./SongCover";
type CommunityRow = { id: string; title: string; artist: string; anime: string; kind: string; coverUrl: string | null; score: number; participants: number; comparisons: number };
type CommunityData = { trackCount: number; participants: number; comparisons: number; rows: CommunityRow[]; provisional: boolean; sampled: boolean };
const TIER_ORDER = ["S", "A", "B", "C", "D"] as const;
export function SongCommunityRanking({ templateId }: { templateId: string | null }) {
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"ranking" | "tier">("ranking");
  const [search, setSearch] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [retryKey, setRetryKey] = useState(0);
  const searchTerm = search.trim().toLocaleLowerCase();
  // Preserve the actual community rank when a user searches. Displaying the
  // filtered list index as a rank would incorrectly turn #57 into #1.
  const filteredRows = (data?.rows ?? []).map((song, index) => ({ ...song, overallRank: index + 1 }))
    .filter(song => !searchTerm ||
      [song.title, song.artist, song.anime].join(" ").toLocaleLowerCase().includes(searchTerm));
  const bucketCount = Math.min(TIER_ORDER.length, Math.max(1, data?.rows.length ?? 0));
  const tierLimit = Math.max(1, Math.ceil(visibleLimit / bucketCount));
  const bucketForRank = (rank: number) => Math.floor((rank - 1) * bucketCount / Math.max(1, data?.rows.length ?? 0));
  // Render a slice from *each* tier instead of only the top 30 overall,
  // which would make A–D look falsely empty on a 256-song ranking.
  const tierSeen = new Map<number, number>();
  const visibleTierRows = filteredRows.filter(song => {
    const bucket = bucketForRank(song.overallRank);
    const seen = (tierSeen.get(bucket) ?? 0) + 1;
    tierSeen.set(bucket, seen);
    return seen <= tierLimit;
  });
  const visibleCount = mode === "ranking" ? Math.min(visibleLimit, filteredRows.length) : visibleTierRows.length;
  const hasMore = visibleCount < filteredRows.length;
  useEffect(() => {
    setData(null); setError(""); setSearch(""); setVisibleLimit(30);
    if (!templateId) return;
    const controller = new AbortController(); setLoading(true);
    songRequest<CommunityData>(`/api/anisong/templates/${templateId}/community-ranking`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "社区榜加载失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [templateId, retryKey]);
  if (!templateId) return <section className="rounded-xl border border-dashed border-white/15 p-8 text-sm text-slate-400">当前曲单尚未公开。公开曲单后，其他人参与对决的结果就会汇总在这里。</section>;
  return <section className="space-y-4" aria-label="音乐社区榜">
    <div><p className="text-[11px] font-bold tracking-[0.18em] text-cyan-200/70">COMMUNITY</p><h2 className="mt-1 text-xl font-bold">社区音乐排行榜</h2><p className="mt-2 text-xs text-slate-400">按当前公开版本的有效对决汇总，每位用户只计一次；个人 Tier 编辑不会改变社区结果。</p></div>
    {loading && <p role="status" className="text-slate-300">正在统计社区对决…</p>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-amber-200"><span>{error}</span><button type="button" className="min-h-10 rounded-xl border border-white/20 px-4 text-sm hover:bg-white/5" onClick={() => setRetryKey(value => value + 1)}>重新加载社区榜</button></div>}
    {data && <>
      <div className="grid grid-cols-3 gap-2">{([["参与人数", data.participants], ["有效对决", data.comparisons], ["歌曲数", data.trackCount]] as const).map(([label,value]) =>
        <div key={label} className="rounded-xl border border-white/10 bg-slate-900/40 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>)}</div>
      {data.provisional && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">目前参与样本较少，排名仅供参考；人数增加后将更稳定。</p>}
      {data.sampled && <p className="text-xs text-slate-400">当前只统计最近的 250 份有效参与记录。</p>}
      <div role="tablist" aria-label="社区榜展示方式" className="flex gap-2"><button type="button" role="tab" aria-selected={mode === "ranking"} onClick={() => setMode("ranking")} className={"rounded-xl border px-4 py-2 text-sm " + (mode === "ranking" ? "border-anime-cyan/60 bg-anime-cyan/10 text-cyan-100" : "border-white/10 text-slate-300")}>社区排名</button><button type="button" role="tab" aria-selected={mode === "tier"} onClick={() => setMode("tier")} className={"rounded-xl border px-4 py-2 text-sm " + (mode === "tier" ? "border-anime-cyan/60 bg-anime-cyan/10 text-cyan-100" : "border-white/10 text-slate-300")}>社区 Tier List</button></div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input type="search" aria-label="搜索社区榜歌曲" placeholder="搜索歌曲、歌手或所属动画…" className="anime-field w-full min-w-0 sm:max-w-sm"
          value={search} onChange={event => { setSearch(event.target.value); setVisibleLimit(30); }} />
        <p className="text-xs text-slate-400">显示 {visibleCount} / {filteredRows.length} 首</p>
      </div>
      {data.rows.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-8 text-sm text-slate-400">还没有有效的社区对决。参与第一场对决后，就会有真实排名。</p> :
        filteredRows.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-slate-400">没有符合条件的歌曲，可以调整歌名、歌手或动画关键词。</p> :
        mode === "ranking" ? <div className="grid gap-3 lg:grid-cols-2">{filteredRows.slice(0, visibleLimit).map(song => <article key={song.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/20 p-3"><span className="w-6 shrink-0 text-center text-sm font-bold text-cyan-100">{song.overallRank}</span><SongCover src={song.coverUrl} title={song.title} className="w-14 shrink-0" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold">{song.title}</p><p className="truncate text-xs text-slate-300">{song.anime || song.artist || "动画信息未填写"}</p><p className="text-xs text-slate-500">{song.participants} 人评价 · {song.comparisons} 次比较</p></div><div className="shrink-0 text-right"><p className="font-bold tabular-nums">{song.score.toFixed(1)}</p><p className="text-[10px] text-slate-400">社区分</p></div></article>)}
          {!filteredRows.length && <p className="p-5 text-sm text-slate-400">没有符合关键词的歌曲，可以尝试别的歌名或动画名。</p>}
          {filteredRows.length > visibleLimit && <div className="flex justify-center lg:col-span-2"><button type="button" className="min-h-11 rounded-xl border border-anime-purple/40 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5" onClick={() => setVisibleLimit(value => value + 30)}>再显示 30 首（剩余 {filteredRows.length - visibleLimit} 首）</button></div>}
        </div> :
        <div className="space-y-3">{TIER_ORDER.map((tier,index) => {
          // Spread the ranked songs across as many tiers as they actually fill, so few participants never leave a gap (S, B).
          const selected = visibleTierRows.filter(song => bucketForRank(song.overallRank) === index);
          return <div key={tier} className="grid grid-cols-[3.5rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-white/10"><div className="flex items-center justify-center bg-slate-800 text-xl font-black">{tier}</div><div className="flex min-h-20 flex-wrap gap-2 p-3">{selected.length ? selected.map(song => <div key={song.id} className="w-20 min-w-0"><SongCover src={song.coverUrl} title={song.title} className="w-full" /><p className="mt-1 line-clamp-2 text-[10px] text-slate-300">{song.title}</p></div>) : <span className="self-center text-xs text-slate-500">暂无歌曲</span>}</div></div>;
        })}<p className="text-xs text-slate-500">社区 Tier 按歌曲在完整社区排名中的位置分档，搜索不会改变原始档位；不代表个人 Tier。</p>{hasMore && <button type="button" className="min-h-11 rounded-xl border border-anime-purple/40 px-4 text-sm hover:bg-white/5" onClick={() => setVisibleLimit(value => value + 30)}>再显示更多歌曲（剩余 {filteredRows.length - visibleTierRows.length} 首）</button>}</div>}
    </>}
  </section>;
}
