"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { KIND_LABELS, SONG_KINDS, MAX_AUDIO_BYTES, MAX_SONG_COVER_BYTES, type SongTrack } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongClipEditor } from "./SongClipEditor";
import { readLocalSongMetadata } from "@/lib/anisong/metadata-reader";

export function SongForm({ track, boardId, busy, onSave, onCancel }: {
  track?: SongTrack; boardId: string; busy: boolean; onSave: (data: FormData) => Promise<boolean>; onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [title, setTitle] = useState(track?.title ?? "");
  const [artist, setArtist] = useState(track?.artist ?? "");
  const [reading, setReading] = useState(false);
  const [metadataNote, setMetadataNote] = useState("");
  const reader = useRef<AbortController | null>(null);
  const touched = useRef({ title: Boolean(track?.title), artist: Boolean(track?.artist), cover: Boolean(track?.coverUrl) });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState("");
  const [audioUrl, setAudioUrl] = useState(track?.source.kind === "url" ? track.source.url : "");
  const [removeAudio, setRemoveAudio] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!audioFile) { setAudioPreview(""); return; }
    const url = URL.createObjectURL(audioFile); setAudioPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);
  const previewSource = audioPreview || (audioUrl.startsWith("https://") ? audioUrl : "") || (!removeAudio && track?.source.kind === "upload" ? `/api/anisong/boards/${boardId}/audio/${track.id}` : "");
  const [coverUrl, setCoverUrl] = useState(track?.coverUrl ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!coverFile) { setPreview(""); return; }
    const url = URL.createObjectURL(coverFile); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);
  useEffect(() => {
    if (!audioFile) { setReading(false); setMetadataNote(""); return; }
    const controller = new AbortController(); reader.current = controller;
    setReading(true); setMetadataNote("");
    void readLocalSongMetadata(audioFile, controller.signal).then(metadata => {
      if (controller.signal.aborted) return;
      if (!touched.current.title) setTitle(metadata.title);
      if (!touched.current.artist) setArtist(metadata.artist);
      if (!touched.current.cover) setCoverFile(metadata.cover ? new File([metadata.cover], "cover.webp", { type: metadata.cover.type }) : null);
      setMetadataNote(metadata.note); setReading(false);
    });
    return () => controller.abort();
  }, [audioFile]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (reading) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (file instanceof File && file.size > MAX_AUDIO_BYTES) { setError("单个音频不能超过20 MB"); return; }
    if (coverFile && coverFile.size > MAX_SONG_COVER_BYTES) { setError("封面图片不能超过5 MB"); return; }
    setError("");
    if (coverFile) data.set("cover", coverFile);
    if (track) data.set("trackId", track.id);
    if (await onSave(data)) form.reset();
  }
  const field = (name: string, label: string, value: string | number, placeholder = "", required = false) => <label className="block text-sm">{label}<input name={name} {...(name === "title" ? { value: title, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { touched.current.title = true; setTitle(e.target.value); } } : name === "artist" ? { value: artist, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { touched.current.artist = true; setArtist(e.target.value); } } : { defaultValue: value })} placeholder={placeholder} required={required} maxLength={120} className="anime-field mt-1.5" /></label>;
  return <form onSubmit={submit} className="rounded-2xl border border-anime-cyan/20 bg-slate-950/50 p-5 sm:p-6">
    <fieldset disabled={busy} className="space-y-5">
      <legend className="mb-4 text-lg font-semibold">{track ? "编辑歌曲" : "添加歌曲"}</legend>
      <div className="flex flex-col gap-4 rounded-xl border border-white/10 p-4 sm:flex-row">
        <SongCover src={preview || coverUrl} title={track?.title || "歌曲"} className="w-28 sm:w-36" eager />
        <div className="min-w-0 flex-1 space-y-3">
          <label className="block text-sm">上传歌曲封面<input ref={coverInput} name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { touched.current.cover = true; setCoverFile(e.target.files?.[0] ?? null); }} className="mt-2 block w-full min-w-0 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" /></label>
          <input type="hidden" name="coverUrl" value={coverUrl} />
          <label className="block text-sm">或填写封面图片地址<input value={coverUrl.startsWith("/uploads/") ? "" : coverUrl} onChange={e => { touched.current.cover = true; setCoverUrl(e.target.value); setCoverFile(null); if (coverInput.current) coverInput.current.value = ""; }} maxLength={2048} placeholder={coverUrl.startsWith("/uploads/") ? "已保存上传的封面，也可换成图片地址" : "https://…/cover.jpg"} className="anime-field mt-1.5" /></label>
          <div className="flex flex-wrap items-center gap-3"><p className="text-xs leading-5 text-slate-400">专辑封面或动画海报均可，最大5 MB。</p>{(coverUrl || coverFile) && <AppButton type="button" size="sm" variant="quiet" onClick={() => { touched.current.cover = true; setCoverUrl(""); setCoverFile(null); if (coverInput.current) coverInput.current.value = ""; }}>移除封面</AppButton>}</div>
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
        <label className="block text-sm">上传音频<input ref={audioInput} name="file" type="file" accept=".mp3,.m4a,.wav,.ogg,.flac,audio/*" onChange={e => { const file = e.target.files?.[0] ?? null; if (file && (!file.size || file.size > MAX_AUDIO_BYTES)) { setError("音频不能为空，且不能超过20 MB"); e.target.value = ""; setAudioFile(null); return; } setError(""); setAudioFile(file); if (file) setAudioUrl(""); }} className="mt-2 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white" /></label>
        <p className="text-xs text-slate-400">MP3 / M4A / WAV / OGG / FLAC，每首最多20 MB。{!removeAudio && track?.source.kind === "upload" ? "已保存音频，不选文件则保留。" : ""}</p>
        <label className="block text-sm">或填写 HTTPS 音频直链<input name="audioUrl" type="url" value={audioUrl} onChange={e => { setAudioUrl(e.target.value); if (e.target.value) { setAudioFile(null); if (audioInput.current) audioInput.current.value = ""; } }} placeholder="https://…/song.mp3" maxLength={2048} className="anime-field mt-1.5" /></label>
        <input type="hidden" name="removeAudio" value={String(removeAudio)} />
        {!removeAudio && track?.source.kind === "netease" && <p className="text-sm text-anime-cyan">已关联网易云音源，保存信息会保留关联。可上传文件替换；平台试听请在保存后使用曲单播放器。</p>}
        {(audioFile || audioUrl || (!removeAudio && (track?.source.kind === "upload" || track?.source.kind === "netease"))) && <AppButton type="button" size="sm" variant="quiet" onClick={() => { setAudioFile(null); setAudioUrl(""); setRemoveAudio(true); if (audioInput.current) audioInput.current.value = ""; }}>移除音频</AppButton>}
        {removeAudio && !audioFile && !audioUrl && <p className="text-xs text-amber-200">保存后将移除音频，歌曲信息和对决记录会保留。</p>}
        <p className="text-xs text-slate-500">请使用你有权使用的音频。平台歌曲页面链接不能直接播放；也可以暂不添加音频。</p>
      </div>
      {reading && <div role="status" className="flex flex-wrap items-center gap-3 text-sm"><span>正在读取本地歌名、歌手和封面…</span><AppButton type="button" variant="quiet" onClick={() => { reader.current?.abort(); setReading(false); setMetadataNote("已跳过自动读取，可手动填写"); }}>跳过自动读取</AppButton></div>}
      {metadataNote && <p role="status" className="text-xs leading-5 text-slate-400">{metadataNote}；已填写或手动修改的内容会保留。</p>}
      <SongClipEditor src={previewSource} initialStart={track?.clipStart} initialLength={track?.clipLength} remote={!removeAudio && track?.source.kind === "netease"} />
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      <div className="flex gap-3"><AppButton type="submit" disabled={reading}>{busy ? "正在保存…" : track ? "保存歌曲" : "添加到曲单"}</AppButton><AppButton type="button" variant="ghost" onClick={onCancel}>收起</AppButton></div>
    </fieldset>
  </form>;
}
