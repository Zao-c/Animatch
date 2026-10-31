"use client";
import { useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { songRequest } from "@/lib/anisong/client";
import { KIND_LABELS, SONG_KINDS, type SongTrack } from "@/lib/anisong/types";
import type { ItunesSong } from "@/lib/anisong/itunes/api";
import { SongCover } from "./SongCover";
export function SongItunesSearch({ track, disabled, onSelect, onRemove, onClose, onSaved, initialOpen = false }: { track?: SongTrack; disabled: boolean; onSelect: (song: ItunesSong, metadata: FormData) => Promise<boolean>; onRemove?: () => Promise<boolean>; onClose?: () => void; onSaved?: () => void; initialOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(track) || initialOpen);
  const [query, setQuery] = useState(track ? `${track.title} ${track.artist}`.slice(0, 100) : "");
  const [country, setCountry] = useState(track?.itunes?.country || "JP");
  const [songs, setSongs] = useState<ItunesSong[]>([]), [searched, setSearched] = useState("");
  const [searching, setSearching] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null), form = useRef<HTMLFormElement>(null), lock = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function search() {
    if (!query.trim()) return;
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setSearching(true); setError("");
    try {
      const value = await songRequest<{ songs: ItunesSong[] }>(`/api/anisong/itunes/search?q=${encodeURIComponent(query.trim())}&country=${country}`, { signal: request.signal });
      if (!request.signal.aborted) { setSongs(value.songs); setSearched(query.trim()); }
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "搜索失败"); }
    finally { if (!request.signal.aborted) setSearching(false); }
  }
  async function select(song: ItunesSong) {
    if (disabled || lock.current || !form.current || !form.current.reportValidity()) return;
    lock.current = true; setSaving(true); setError("");
    try { if (await onSelect(song, new FormData(form.current))) { setSearched(`已${track ? "关联" : "加入"}：${song.reference.title}`); if (track) (onSaved ?? onClose)?.(); } }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { lock.current = false; setSaving(false); }
  }
  return <section className={`rounded-2xl border bg-slate-950/30 p-4 sm:p-5 ${track ? "border-cyan-300/30" : "border-white/10"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{track ? `为「${track.title}」匹配 iTunes 备用源` : "从 iTunes 找歌"}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{track ? "核对歌手、语言和录音版本，确认后才会在降级时使用。" : "无需音乐平台账号，添加外部试听与封面；也可给公共池歌曲补充备用源。"}</p></div><AppButton size="sm" variant="secondary" disabled={disabled || saving} onClick={() => track ? onClose?.() : setOpen(value => !value)}>{track ? "收起匹配" : open ? "收起 iTunes 搜索" : "打开 iTunes 搜索"}</AppButton></div>
    {open && <div className="mt-4 space-y-4">
      {track?.itunes && <div className="flex flex-wrap items-center gap-3 text-xs"><span className="text-cyan-200">已关联：{track.itunes.title} · {track.itunes.artist}（{track.itunes.country}）</span><AppButton size="sm" variant="quiet" disabled={disabled || saving} onClick={() => { if (onRemove) void onRemove().then(saved => { if (saved) (onSaved ?? onClose)?.(); }); }}>移除 iTunes 匹配</AppButton></div>}
      <form onSubmit={event => { event.preventDefault(); void search(); }} className="flex flex-wrap gap-2"><input aria-label="iTunes 搜索关键词" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="歌名 + 歌手" className="anime-field min-w-0 flex-1" /><select aria-label="iTunes 商店地区" value={country} onChange={event => { controller.current?.abort(); setSearching(false); setCountry(event.target.value); setSongs([]); setSearched(""); }} className="anime-field w-auto"><option value="JP">日本</option><option value="US">美国</option><option value="HK">香港</option><option value="TW">台湾</option><option value="GB">英国</option></select><AppButton type="submit" disabled={searching || !query.trim()}>{searching ? "搜索中…" : "搜索 iTunes"}</AppButton></form>
      <form ref={form} onSubmit={event => event.preventDefault()} className={track ? "hidden" : "grid gap-3 sm:grid-cols-4"}>
        <label className="text-xs text-slate-400">加入时的类型<select name="kind" defaultValue="OP" className="anime-field mt-1" disabled={disabled || saving}>{SONG_KINDS.map(kind => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}</select></label>
        <label className="text-xs text-slate-400">所属动画<input name="anime" maxLength={120} className="anime-field mt-1" disabled={disabled || saving} /></label>
        <label className="text-xs text-slate-400">年份<input name="year" type="number" min={1900} max={2100} className="anime-field mt-1" disabled={disabled || saving} /></label>
        <label className="text-xs text-slate-400">季度<select name="quarter" className="anime-field mt-1" disabled={disabled || saving}><option value="">未指定</option>{["冬季", "春季", "夏季", "秋季"].map((q, index) => <option key={q} value={index + 1}>{q}</option>)}</select></label>
      </form>
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {searched && <p role="status" className="text-xs text-slate-400">{searched.startsWith("已") ? searched : `「${searched}」· ${songs.length} 个结果`}</p>}
      <ul className="max-h-[28rem] space-y-2 overflow-y-auto">{songs.map(song => <li key={`${song.reference.country}-${song.reference.id}`} className="flex items-start gap-3 rounded-xl border border-white/10 p-3"><SongCover src={song.coverUrl} title={song.reference.title} className="w-16 sm:w-20" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{song.reference.title}</p><p className="mt-1 break-words text-xs text-slate-300">{song.reference.artist}</p><p className="mt-1 break-words text-xs text-slate-500">{song.album}</p><div className="mt-2 flex flex-wrap items-center gap-3"><AppButton size="sm" variant="secondary" disabled={disabled || saving || !song.hasPreview} onClick={() => void select(song)}>{song.hasPreview ? track ? "关联此版本" : "加入 iTunes 曲目" : "暂无试听"}</AppButton><a href={song.reference.storeUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-400 underline">在 iTunes 中查看 ↗</a></div></div></li>)}</ul>
      <p className="text-xs leading-5 text-slate-500">iTunes 试听由平台选取片段，直接流播，不下载进公共池。来自不同平台的片段可能不同。</p>
    </div>}
  </section>;
}
