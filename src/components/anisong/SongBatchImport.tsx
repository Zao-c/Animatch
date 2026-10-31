"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { KIND_LABELS, MAX_AUDIO_BYTES, MAX_TRACKS, SONG_KINDS, type SongTrack } from "@/lib/anisong/types";

import { readLocalSongMetadata } from "@/lib/anisong/metadata-reader";
import { filenameMetadata } from "@/lib/anisong/metadata";
import { LocalSongCover } from "./LocalSongCover";
import { createClientUuid } from "@/lib/client-id";

type Item = { key: string; file: File; title: string; artist: string; cover: Blob | null; note: string; status: "queued" | "uploading" | "done" | "failed"; data?: FormData };
export function SongBatchImport({ tracks, disabled, onSave, onRunning, onCancel }: {
  tracks: SongTrack[]; disabled: boolean; onSave: (data: FormData) => Promise<boolean>;
  onRunning: (running: boolean) => void; onCancel: (hasPending: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [reading, setReading] = useState(false);
  const reader = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState("");
  const stop = useRef(false);
  const active = useRef(false);
  const save = useRef(onSave); save.current = onSave;
  useEffect(() => () => { stop.current = true; reader.current?.abort(); }, []);
  const doneKeys = new Set(tracks.flatMap(t => t.importKey ? [t.importKey] : []));
  const pending = items.filter(item => item.status !== "done" && !doneKeys.has(item.key));
  const duplicate = (item: Item) => !item.data && [...tracks, ...items.filter(i => i.key !== item.key)].some(t => t.title.trim().toLocaleLowerCase() === item.title.trim().toLocaleLowerCase() && t.artist.trim().toLocaleLowerCase() === item.artist.trim().toLocaleLowerCase());
  async function choose(files: FileList | null) {
    if (!files || active.current) return;
    const next = [...items];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      if (!/\.(mp3|m4a|wav|ogg|flac)$/i.test(file.name) || !file.size || file.size > MAX_AUDIO_BYTES) { rejected.push(`${file.name}：需为支持的音频且不超过20 MB`); continue; }
      if (next.some(i => i.file.name === file.name && i.file.size === file.size && i.file.lastModified === file.lastModified)) continue;
      if (next.filter(i => i.status !== "done" && !doneKeys.has(i.key)).length >= MAX_TRACKS - tracks.length) { rejected.push(`${file.name}：曲单最多64首`); continue; }
      next.push({ key: createClientUuid(), file, ...filenameMetadata(file.name), cover: null, note: "等待读取文件信息…", status: "queued" });
    }
    setItems(next); setMessage(rejected.join("；"));
    const additions = next.filter(item => !items.some(previous => previous.key === item.key));
    if (!additions.length) return;
    const controller = new AbortController(); reader.current = controller;
    active.current = true; setReading(true); onRunning(true);
    try {
      for (const item of additions) {
        const metadata = await readLocalSongMetadata(item.file, controller.signal);
        setItems(previous => previous.map(i => i.key === item.key ? { ...i, ...metadata } : i));
      }
    } finally { reader.current = null; active.current = false; setReading(false); onRunning(false); }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (active.current || disabled || !pending.length) return;
    if (pending.length > MAX_TRACKS - tracks.length) { setMessage("剩余名额不足，请移除部分待导入歌曲。"); return; }
    const totalBytes = tracks.reduce((sum, track) => sum + (track.source.kind === "upload" ? track.source.bytes : 0), 0) + pending.reduce((sum, item) => sum + item.file.size, 0);
    if (totalBytes > 250 * 1024 * 1024) { setMessage("这些文件加上曲单已有音频超过250 MB，请移除部分待导入文件。"); return; }
    if (pending.some(duplicate) && !window.confirm("曲单或待导入列表中有同名、同歌手歌曲，仍要导入这些文件吗？")) return;
    const common = new FormData(e.currentTarget);
    // Freeze each request before starting: a retry must represent the same song.
    const queue = pending.map(item => {
      if (item.data) return item;
      const data = new FormData();
      for (const [key, value] of common.entries()) data.set(key, value);
      data.set("file", item.file); data.set("title", item.title.trim()); data.set("artist", item.artist.trim()); data.set("importKey", item.key);
      if (item.cover) data.set("cover", item.cover, "cover.webp");
      return { ...item, data };
    });
    setItems(previous => previous.map(i => queue.find(q => q.key === i.key) ?? i));
    active.current = true; stop.current = false; setStopping(false); setRunning(true); onRunning(true); setMessage("");
    let completed = 0;
    try {
      for (const item of queue) {
        if (stop.current) break;
        setItems(previous => previous.map(i => i.key === item.key ? { ...i, status: "uploading" } : i));
        let saved = false;
        try { saved = await save.current(item.data!); } catch { /* Preserve the item and its key for a deliberate retry. */ }
        setItems(previous => previous.map(i => i.key === item.key ? { ...i, status: saved ? "done" : "failed" } : i));
        if (!saved) { setMessage("导入已暂停。请处理上方错误后继续；已保存的歌曲会自动跳过，不会重复添加。"); return; }
        completed++;
      }
      setMessage(stop.current ? `已暂停，本轮已保存 ${completed} 首，剩余文件可继续导入。` : `本轮已保存 ${completed} 首。可收起导入面板，补充每首歌的封面和试听片段。`);
    } finally { active.current = false; setRunning(false); onRunning(false); }
  }
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-anime-cyan/20 bg-slate-950/50 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">批量导入本地音频</h2>
    <p className="text-sm leading-6 text-slate-400">自动读取本地文件中的歌名、歌手和封面，导入前可修改。支持 MP3 / M4A / WAV / OGG / FLAC，每首20 MB以内；曲单音频合计250 MB以内。</p>
    <fieldset disabled={reading || running || disabled} className="min-w-0 space-y-4">
      <label className="block text-sm">选择音频文件<input type="file" multiple accept=".mp3,.m4a,.wav,.ogg,.flac" className="mt-2 block w-full min-w-0 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" onChange={e => { void choose(e.target.files); e.target.value = ""; }} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">统一类型<select name="kind" className="anime-field mt-1" defaultValue="OP">{SONG_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>
        <label className="text-sm">年份<input name="year" type="number" min={1900} max={2100} className="anime-field mt-1" placeholder="可选" /></label>
        <label className="text-sm">季度<select name="quarter" className="anime-field mt-1"><option value="">未指定</option>{["冬季", "春季", "夏季", "秋季"].map((q, i) => <option key={q} value={i + 1}>{q}</option>)}</select></label>
      </div>
      <p className="text-xs text-slate-500">统一设置用于尚未开始的这一批。暂停后继续会保留原设置；默认从开头试听30秒。</p>
      <ul className="max-h-96 space-y-3 overflow-y-auto">
        {items.map(item => {
          const done = item.status === "done" || doneKeys.has(item.key);
          return <li key={item.key} className="space-y-2 rounded-xl border border-white/10 p-3">
            <div className="flex items-center gap-3"><LocalSongCover cover={item.cover} title={item.title} /><div className="min-w-0 flex-1 space-y-2"><div className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-slate-400" title={item.file.name}>{item.file.name} · {item.file.size < 1024 * 1024 ? `${Math.ceil(item.file.size / 1024)} KB` : `${(item.file.size / 1024 / 1024).toFixed(1)} MB`}</span><span className="shrink-0 text-anime-cyan">{done ? "已保存" : item.status === "uploading" ? "正在上传…" : item.status === "failed" ? "待重试" : "待导入"}</span></div><p className="text-xs leading-5 text-slate-500">{item.note}</p></div></div>
            {!done && <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs">歌名<input required maxLength={120} readOnly={Boolean(item.data)} value={item.title} className="anime-field mt-1" onChange={e => setItems(previous => previous.map(i => i.key === item.key ? { ...i, title: e.target.value } : i))} /></label><label className="text-xs">歌手<input maxLength={120} readOnly={Boolean(item.data)} value={item.artist} className="anime-field mt-1" onChange={e => setItems(previous => previous.map(i => i.key === item.key ? { ...i, artist: e.target.value } : i))} /></label><AppButton type="button" variant="quiet" className="self-end" onClick={() => setItems(previous => previous.filter(i => i.key !== item.key))}>移除</AppButton></div>}
            {!done && !item.data && <div className="flex flex-wrap items-center gap-2"><label className="min-w-0 text-xs text-slate-400">替换封面<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-1 block w-full min-w-0 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" onChange={e => { const cover = e.target.files?.[0]; if (cover) { if (cover.size > 5 * 1024 * 1024) setMessage("封面不能超过5 MB"); else setItems(previous => previous.map(i => i.key === item.key ? { ...i, cover, note: "已使用手动选择的封面" } : i)); } e.target.value = ""; }} /></label>{item.cover && <AppButton type="button" variant="quiet" size="sm" onClick={() => setItems(previous => previous.map(i => i.key === item.key ? { ...i, cover: null, note: "已移除封面" } : i))}>移除封面</AppButton>}</div>}
            {!done && duplicate(item) && <p className="text-xs text-amber-200">曲单或待导入列表中有同名、同歌手歌曲，请确认是否需要重复导入。</p>}
          </li>;
        })}
      </ul>
      <div className="flex flex-wrap gap-3"><AppButton type="submit" disabled={!pending.length || pending.some(i => !i.title.trim())}>导入剩余 {pending.length} 首</AppButton><AppButton type="button" variant="ghost" onClick={() => onCancel(pending.length > 0)}>收起</AppButton></div>
    </fieldset>
    {reading && <div role="status" className="flex flex-wrap items-center gap-3 text-sm"><span>正在读取本地文件信息…</span><AppButton type="button" variant="ghost" onClick={() => reader.current?.abort()}>跳过自动读取</AppButton></div>}
    {running && <div className="flex flex-wrap items-center gap-3"><span role="status" className="text-sm text-slate-300">已保存 {items.filter(i => i.status === "done" || doneKeys.has(i.key)).length} / {items.length} 首</span><AppButton type="button" variant="ghost" disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }}> {stopping ? "当前歌曲保存后暂停…" : "暂停导入"}</AppButton></div>}
    {message && <p role="status" className="break-words text-sm leading-6 text-slate-300">{message}</p>}
  </form>;
}
