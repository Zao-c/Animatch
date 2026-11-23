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
  return <section aria-label="我的音乐 Tier List" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-semibold">我的音乐 Tier List</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">自动档位反映当前曲单内的相对偏好。可以手动分档；对决历史与 Elo 不会因此改变。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AppButton variant="secondary" disabled={disabled || editing} onClick={onExportPng}>导出 PNG</AppButton>
        <AppButton variant="ghost" disabled={disabled || editing} onClick={exportJson}>导出榜单 JSON</AppButton>
      </div>
    </div>
    <SongTierEditor snapshot={snapshot} busy={disabled} onSave={onLayout} onReset={onReset} onEditingChange={setEditing} />
    <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
      <summary className="cursor-pointer font-semibold">分享这一刻的榜单</summary>
      <p className="mt-3 text-sm text-slate-400">分享快照包含封面、歌曲信息与分档，不包含音频。之后继续对决不会自动改变旧快照。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <AppButton disabled={disabled || editing} onClick={onPublish}>{board.shareToken ? "更新分享快照" : "生成分享链接"}</AppButton>
        {board.shareToken && <AppButton variant="ghost" disabled={disabled || editing} onClick={onUnpublish}>关闭分享</AppButton>}
      </div>
      {shareUrl && <div className="mt-3 flex flex-wrap items-center gap-3">
        <input readOnly aria-label="分享链接" value={shareUrl} className="anime-field min-w-0 flex-1" onFocus={event => event.target.select()} />
        <AppButton variant="secondary" onClick={() => void copyShare()}>复制</AppButton>
        <Link href={"/anisong/share/" + board.shareToken} target="_blank" className="text-sm text-anime-cyan underline">查看快照</Link>
      </div>}
    </details>
  </section>;
}
