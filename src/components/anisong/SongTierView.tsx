import { KIND_LABELS, type SongSnapshot } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
export function SongTierView({ snapshot, onTier, busy = false }: { snapshot: SongSnapshot; onTier?: (trackId: string, tier: string | null) => void; busy?: boolean }) {
  return <div className="overflow-hidden rounded-2xl border border-white/10">
    {snapshot.rows.map(row => <div key={row.id} className="grid min-h-24 grid-cols-[64px_minmax(0,1fr)] border-b border-white/10 last:border-b-0 sm:grid-cols-[96px_minmax(0,1fr)]">
      <div style={{ backgroundColor: row.color }} className="flex items-center justify-center px-2 text-center text-xl font-black text-slate-950 sm:text-2xl">{row.label}</div>
      <div className="flex flex-wrap items-start gap-2 bg-slate-950/35 p-3">
        {row.songs.length ? row.songs.map(song => <article key={song.id} className="w-[calc(50%-4px)] min-w-0 rounded-xl border border-white/10 bg-slate-800/70 p-2 sm:w-40">
          <SongCover src={song.coverUrl} title={song.title} className="mb-2 w-full" />
          <p className="break-words font-semibold">{song.title}</p><p className="mt-1 break-words text-xs text-slate-400">{song.artist || "歌手未填写"}</p>
          <p className="mt-2 break-words text-xs text-anime-cyan">{KIND_LABELS[song.kind]}{song.anime ? ` · ${song.anime}` : ""}{song.manual ? " · 手动" : ""}</p>
          {onTier && row.id !== "hidden" && <select aria-label={`${song.title} 分档`} disabled={busy} className="mt-3 min-h-9 w-full px-2 text-xs" value={song.manual ? row.id : ""} onChange={e => onTier(song.id, e.target.value || null)}>
            <option value="">自动分档</option>{["s", "a", "b", "c", "d"].map(t => <option value={t} key={t}>手动 {t.toUpperCase()}</option>)}
          </select>}
        </article>) : <span className="self-center text-sm text-slate-500">暂无歌曲</span>}
      </div>
    </div>)}
  </div>;
}
