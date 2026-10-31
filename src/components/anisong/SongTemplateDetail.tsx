"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui/AppButton";
import { songRequest, SongApiError } from "@/lib/anisong/client";
import { KIND_LABELS, type SongBoardView, type SongDocument, type SongTemplateView } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongPlaybackPreferences } from "./SongPlaybackPreferences";
export function SongTemplateDetail({ templateId }: { templateId: string }) {
  const router = useRouter(); const lock = useRef(false);
  const [template, setTemplate] = useState<(SongTemplateView & { document: SongDocument }) | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); songRequest<NonNullable<typeof template>>(`/api/anisong/templates/${templateId}`, { signal: controller.signal }).then(setTemplate).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }); return () => controller.abort(); }, [templateId]);
  async function start() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const board = await songRequest<SongBoardView>(`/api/anisong/templates/${templateId}/start`, { method: "POST" }); router.push(`/anisong/${board.id}?view=match`); }
    catch (cause) { if (cause instanceof SongApiError && cause.status === 401) router.push(`/login?next=${encodeURIComponent(`/anisong/templates/${templateId}`)}`); else setError(cause instanceof Error ? cause.message : "开始失败"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mx-auto w-full max-w-[90rem] space-y-6"><Link href="/anisong" className="text-sm text-anime-cyan">← 公共音乐曲单</Link>
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    {!template ? !error && <p role="status">正在加载曲单…</p> : <>
      <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="break-words text-2xl font-bold sm:text-3xl">{template.title}</h1><p className="mt-3 text-sm text-slate-400">{template.trackCount} 首 · 创建者 {template.ownerName} · 版本 {template.revision}</p><p className="mt-2 text-xs leading-6 text-slate-500">可试听 {template.playableCount} 首 · 公共池 {template.poolCount} 首 · iTunes {template.itunesCount} 首。只需 AniMatch 账号保存个人进度，无需网易云账号。</p></div><AppButton disabled={busy} onClick={() => void start()}>{busy ? "正在准备…" : "开始 / 继续我的对决"}</AppButton></header>
      <SongPlaybackPreferences />
      <div className="grid gap-3 sm:grid-cols-2">{template.document.tracks.map(track => <article key={track.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/30 p-4"><SongCover src={track.coverUrl} title={track.title} className="w-20" /><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{track.title}</h2><p className="mt-1 break-words text-xs text-slate-400">{track.artist || "歌手未填写"}</p><p className="mt-2 break-words text-xs text-slate-500">{KIND_LABELS[track.kind]}{track.anime ? ` · ${track.anime}` : ""}</p><p className="mt-2 text-xs text-cyan-200">{track.source.kind === "pool" ? "公共池已就绪" : "公共池待补充"} · {track.itunes || track.source.kind === "itunes" ? "iTunes 已匹配" : "iTunes 待匹配"}</p>{track.itunes && <a href={track.itunes.storeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-slate-400 underline">在 iTunes 中查看 ↗</a>}</div></article>)}</div>
      <p className="text-xs leading-6 text-slate-500">开始后会建立或继续你的独立对决进度。创建者更新公共曲单，不会改动你已经开始的版本和比较记录。</p>
    </>}
  </div>;
}
