"use client";
import Link from "next/link";
import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { downloadSongFile } from "@/lib/anisong/client";
import type { SongBoardView, SongSnapshot } from "@/lib/anisong/types";
import { SongTierEditor } from "./SongTierEditor";

export function SongTierPanel({ board, snapshot, disabled, shareUrl, onLayout, onReset, onExportPng, onPublish, onUnpublish, onNotice, onError }: {
  board: SongBoardView; snapshot: SongSnapshot; disabled: boolean; shareUrl: string;
  onLayout: (rows: Record<string, string[]>) => Promise<boolean>;
  onReset: () => Promise<boolean>;
  onExportPng: () => void; onPublish: () => void; onUnpublish: () => void;
  onNotice: (notice: string) => void; onError: (error: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  function exportJson() {
    if (editing || disabled) return;
    const filename = board.title.replace(/[\\/:*?"<>|]/g, "_") + "-TierList.json";
    downloadSongFile(filename, new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
  }
  async function copyShare() {
    try { await navigator.clipboard.writeText(shareUrl); onNotice("分享链接已复制"); }
    catch { onError("复制失败，请选中链接手动复制。"); }
  }
  return <section aria-label="我的音乐 Tier List" className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold text-white">歌曲分层</h2><p className="text-xs text-slate-400">{board.document.tracks.length} 首歌曲 · {snapshot.comparisons} 场有效对决</p></div>
      <SongTierEditor snapshot={snapshot} busy={disabled} onSave={onLayout} onReset={onReset} onEditingChange={setEditing} />
    </div>
    <aside className="min-w-0 space-y-3 xl:sticky xl:top-24">
      <h2 className="text-base font-bold text-white">设置与分享</h2>
      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap gap-2"><AppButton disabled={disabled || editing} onClick={onExportPng}>导出 PNG</AppButton><AppButton variant="ghost" disabled={disabled || editing} onClick={exportJson}>导出榜单 JSON</AppButton></div>
        <AppButton variant="secondary" disabled={disabled || editing} onClick={onPublish}>{board.shareToken ? "更新分享快照" : "生成分享链接"}</AppButton>
        <p className="text-xs leading-6 text-slate-400">图片与分享快照按已保存的排序生成。之后继续对决不会自动改变旧快照；快照包含封面与分档，不包含音频。</p>
        {board.shareToken && <AppButton variant="ghost" disabled={disabled || editing} onClick={onUnpublish}>关闭分享</AppButton>}
        {shareUrl && <div className="space-y-2"><input readOnly aria-label="分享链接" value={shareUrl} className="anime-field min-w-0 w-full text-xs" onFocus={event => event.target.select()} /><div className="flex flex-wrap items-center gap-3"><AppButton variant="secondary" onClick={() => void copyShare()}>复制</AppButton><Link href={"/anisong/share/" + board.shareToken} target="_blank" className="text-sm text-anime-cyan underline">查看快照</Link></div></div>}
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4"><Link href={"/anisong/" + board.id + "/match"} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-200 hover:bg-white/10">继续对决</Link><Link href={"/anisong/" + board.id} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-200 hover:bg-white/10">返回曲单</Link></div>
        <details className="text-xs leading-6 text-slate-400"><summary className="min-h-9 cursor-pointer py-2">榜单说明</summary><p>自动分档反映当前曲单内的相对偏好。手动分档不会改变对决历史与 Elo。</p></details>
      </div>
    </aside>
  </section>;
}
