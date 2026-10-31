import { KIND_LABELS, type SongSnapshot } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
export function SongTierView({ snapshot, onTier, busy = false }: { snapshot: SongSnapshot; onTier?: (trackId: string, tier: string | null) => void; busy?: boolean }) {
  return <div className="space-y-3">
    {snapshot.rows.map(row => <section key={row.id} className="grid min-w-0 gap-3 rounded-2xl border border-anime-border bg-anime-panel p-3 sm:grid-cols-[80px_minmax(0,1fr)]">
      <div style={{ backgroundColor: row.color }} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-center sm:flex-col sm:justify-center"><span className="max-w-full text-2xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere]">{row.label}</span><span className="text-xs font-semibold text-slate-950">{row.songs.length} 首</span></div>
      {row.songs.length ? <div className="grid min-w-0 grid-cols-3 items-start gap-2 sm:grid-cols-[repeat(auto-fill,minmax(88px,1fr))]">
        {row.songs.map(song => <article key={song.id} title={[song.title, song.artist, song.anime].filter(Boolean).join(" · ")} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
          <SongCover src={song.coverUrl} title={song.title} className="w-full !rounded-none !border-0" />
          <div className="space-y-1 p-1.5"><p className="line-clamp-2 min-h-8 break-words text-[11px] font-semibold leading-4">{song.title}</p><p className="truncate text-[10px] text-slate-400">{song.artist || "歌手未填写"}</p>
          <p className="truncate text-[10px] text-anime-cyan">{KIND_LABELS[song.kind]}{song.anime ? ` · ${song.anime}` : ""}{song.manual ? " · 手动" : ""}</p>
          {onTier && row.id !== "hidden" && <select aria-label={`${song.title} 分档`} disabled={busy} className="min-h-9 w-full px-1 text-xs" value={song.manual ? row.id : ""} onChange={e => onTier(song.id, e.target.value || null)}>
            <option value="">自动分档</option>{["s", "a", "b", "c", "d"].map(t => <option value={t} key={t}>手动 {t.toUpperCase()}</option>)}
          </select>}</div>
        </article>)}
      </div> : <div className="flex min-h-24 items-center rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-4"><p className="text-sm text-slate-500">{row.label} Tier 暂无歌曲。</p></div>}
    </section>)}
  </div>;
}
