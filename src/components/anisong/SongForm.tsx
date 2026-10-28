"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { KIND_LABELS, SONG_KINDS, MAX_AUDIO_BYTES, MAX_SONG_COVER_BYTES, type SongTrack } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";

export function SongForm({ track, busy, onSave, onCancel }: {
  track?: SongTrack; busy: boolean; onSave: (data: FormData) => Promise<boolean>; onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [coverUrl, setCoverUrl] = useState(track?.coverUrl ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!coverFile) { setPreview(""); return; }
    const url = URL.createObjectURL(coverFile); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (file instanceof File && file.size > MAX_AUDIO_BYTES) { setError("单个音频不能超过20 MB"); return; }
    if (coverFile && coverFile.size > MAX_SONG_COVER_BYTES) { setError("封面图片不能超过5 MB"); return; }
    setError("");
    if (track) data.set("trackId", track.id);
    if (await onSave(data)) form.reset();
  }
  const field = (name: string, label: string, value: string | number, placeholder = "", required = false) => <label className="block text-sm">{label}<input name={name} defaultValue={value} placeholder={placeholder} required={required} maxLength={120} className="anime-field mt-1.5" /></label>;
  return <form onSubmit={submit} className="rounded-2xl border border-anime-cyan/20 bg-slate-950/50 p-5 sm:p-6">
    <fieldset disabled={busy} className="space-y-5">
      <legend className="mb-4 text-lg font-semibold">{track ? "编辑歌曲" : "添加歌曲"}</legend>
      <div className="flex flex-col gap-4 rounded-xl border border-white/10 p-4 sm:flex-row">
        <SongCover src={preview || coverUrl} title={track?.title || "歌曲"} className="w-28 sm:w-36" eager />
        <div className="min-w-0 flex-1 space-y-3">
          <label className="block text-sm">上传歌曲封面<input ref={coverInput} name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => setCoverFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full min-w-0 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" /></label>
          <input type="hidden" name="coverUrl" value={coverUrl} />
          <label className="block text-sm">或填写封面图片地址<input value={coverUrl.startsWith("/uploads/") ? "" : coverUrl} onChange={e => setCoverUrl(e.target.value)} maxLength={2048} placeholder={coverUrl.startsWith("/uploads/") ? "已保存上传的封面，也可换成图片地址" : "https://…/cover.jpg"} className="anime-field mt-1.5" /></label>
          <div className="flex flex-wrap items-center gap-3"><p className="text-xs leading-5 text-slate-400">专辑封面或动画海报均可，最大5 MB。</p>{(coverUrl || coverFile) && <AppButton type="button" size="sm" variant="quiet" onClick={() => { setCoverUrl(""); setCoverFile(null); if (coverInput.current) coverInput.current.value = ""; }}>移除封面</AppButton>}</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("title", "歌名 *", track?.title ?? "", "歌曲名称", true)}
        {field("artist", "歌手", track?.artist ?? "", "演唱者 / 乐队")}
        {field("anime", "所属动画", track?.anime ?? "", "动画名称")}
        <label className="text-sm">类型<select name="kind" defaultValue={track?.kind ?? "OP"} className="anime-field mt-1.5">{SONG_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>
        <label className="text-sm">播出年份<input name="year" type="number" min={1900} max={2100} defaultValue={track?.year ?? ""} placeholder="如 2026" className="anime-field mt-1.5" /></label>
        <label className="text-sm">季度<select name="quarter" defaultValue={track?.quarter ?? ""} className="anime-field mt-1.5"><option value="">未指定</option>{["冬季 · 1月", "春季 · 4月", "夏季 · 7月", "秋季 · 10月"].map((q, i) => <option key={q} value={i + 1}>{q}</option>)}</select></label>
      </div>
      <label className="block text-sm">风格标签<input name="tags" defaultValue={track?.tags.join(", ") ?? ""} maxLength={160} placeholder="摇滚, 治愈, 电音（逗号分隔）" className="anime-field mt-1.5" /></label>
      <div className="space-y-4 rounded-xl border border-white/10 p-4">
        <label className="block text-sm">上传音频<input name="file" type="file" accept=".mp3,.m4a,.wav,.ogg,.flac,audio/*" className="mt-2 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" /></label>
        <p className="text-xs text-slate-400">MP3 / M4A / WAV / OGG / FLAC，每首最多20 MB。{track?.source.kind === "upload" ? "已保存音频，不选文件则保留。" : ""}</p>
        <label className="block text-sm">或填写 HTTPS 音频直链<input name="audioUrl" type="url" defaultValue={track?.source.kind === "url" ? track.source.url : ""} placeholder="https://…/song.mp3" maxLength={2048} className="anime-field mt-1.5" /></label>
        <p className="text-xs text-slate-500">请使用你有权使用的音频。平台歌曲页面链接不能直接播放；也可以暂不添加音频。</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">试听起点（秒）<input name="clipStart" type="number" min={0} max={3600} step={0.1} defaultValue={track?.clipStart ?? 0} className="anime-field mt-1.5" /></label>
        <label className="text-sm">试听长度（秒）<input name="clipLength" type="number" min={5} max={90} step={1} defaultValue={track?.clipLength ?? 30} className="anime-field mt-1.5" /></label>
      </div>
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      <div className="flex gap-3"><AppButton type="submit">{busy ? "正在保存…" : track ? "保存歌曲" : "添加到曲单"}</AppButton><AppButton type="button" variant="ghost" onClick={onCancel}>收起</AppButton></div>
    </fieldset>
  </form>;
}
