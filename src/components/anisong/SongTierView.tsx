"use client";
import { KIND_LABELS, type SongSnapshot } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
export function SongTierView({ snapshot, onTier, busy = false, compact = true, editing = false, selectedId, dragSource, onSelect, onDragSource, onMove }: {
  snapshot: SongSnapshot; onTier?: (trackId: string, tier: string | null) => void; busy?: boolean;
  compact?: boolean; editing?: boolean; selectedId?: string | null; dragSource?: string | null;
  onSelect?: (id: string) => void; onDragSource?: (id: string | null) => void;
  onMove?: (id: string, tier: string, before?: string) => void;
}) {
  return <div className="space-y-3">
    {snapshot.rows.map(row => {
      const movable = ["s", "a", "b", "c", "d"].includes(row.id);
      return <section key={row.id} data-tier-row={row.id} onDragOver={event => { if (editing && movable && dragSource && !busy) event.preventDefault(); }} onDrop={event => { if (!editing || !movable || !dragSource || busy) return; event.preventDefault(); onMove?.(dragSource, row.id); onDragSource?.(null); }} className={"grid min-w-0 gap-3 rounded-2xl border bg-anime-panel p-3 sm:grid-cols-[80px_minmax(0,1fr)] " + (dragSource && movable ? "border-anime-cyan/40" : "border-anime-border")}>
      <div style={{ backgroundColor: row.color }} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-center sm:flex-col sm:justify-center"><span className="max-w-full text-2xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere]">{row.label}</span><span className="text-xs font-semibold text-slate-950">{row.songs.length} 首</span></div>
      {row.songs.length ? <div className="flex min-w-0 flex-wrap content-start items-start gap-2">
        {row.songs.map(song => <article key={song.id} data-tier-song={song.id} title={[song.title, song.artist, song.anime].filter(Boolean).join(" · ")}
          draggable={editing && !busy && row.id !== "hidden" && row.id !== "excluded"}
          onDragStart={event => { if (!editing || busy || row.id === "hidden" || row.id === "excluded") { event.preventDefault(); return; } onDragSource?.(song.id); onSelect?.(song.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", song.id); }} onDragEnd={() => onDragSource?.(null)}
          onDragOver={event => { if (editing && movable && dragSource && dragSource !== song.id && !busy) event.preventDefault(); }}
          onDrop={event => { if (!editing || !movable || !dragSource || busy) return; event.stopPropagation(); event.preventDefault(); onMove?.(dragSource, row.id, song.id); onDragSource?.(null); }}
          className={(compact ? "w-[72px] sm:w-[88px] " : "w-[calc(50%-4px)] sm:w-36 ") + "min-w-0 overflow-hidden rounded-xl border bg-slate-950/40 " + (editing && selectedId === song.id ? "border-anime-cyan ring-2 ring-anime-cyan/40" : "border-white/10") }>
          <button type="button" disabled={!editing || busy || row.id === "hidden" || row.id === "excluded"} aria-label={`选择调整：${song.title}`} aria-pressed={editing ? selectedId === song.id : undefined} onClick={() => onSelect?.(song.id)} className={"block w-full text-left disabled:cursor-default " + (editing ? "cursor-grab active:cursor-grabbing" : "")}>
            <SongCover src={song.coverUrl} title={song.title} className="pointer-events-none w-full !rounded-none !border-0" />
            <span className="block p-1.5"><span className="line-clamp-2 min-h-8 break-words text-[11px] font-semibold leading-4">{song.title}</span>{!compact && <><span className="mt-1 block truncate text-[10px] text-slate-400">{song.artist || "歌手未填写"}</span><span className="mt-1 block truncate text-[10px] text-anime-cyan">{KIND_LABELS[song.kind]}{song.anime ? ` · ${song.anime}` : ""}{song.manual ? " · 手动" : ""}</span></>}</span>
          </button>
          {onTier && row.id !== "hidden" && <select aria-label={`${song.title} 分档`} disabled={busy} className="min-h-9 w-full px-1 text-xs" value={song.manual ? row.id : ""} onChange={e => onTier(song.id, e.target.value || null)}><option value="">自动分档</option>{["s", "a", "b", "c", "d"].map(t => <option value={t} key={t}>手动 {t.toUpperCase()}</option>)}</select>}
        </article>)}
      </div> : <div className="flex min-h-24 items-center rounded-xl border border-dashed border-white/10 px-4"><p className="text-xs text-slate-500">{editing && movable ? "拖动歌曲到这里" : "暂无歌曲"}</p></div>}
    </section>;
    })}
  </div>;
}
