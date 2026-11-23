"use client";
import { useEffect, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { songRequest } from "@/lib/anisong/client";
import { SongShareButton } from "./SongShareButton";

export type SongVisibility = { isPublic: boolean; templateId: string | null; canManage: boolean };
export function SongVisibilityActions({ boardId, disabled, onChange, value, showToggle = true }: {
  boardId: string; disabled?: boolean; showToggle?: boolean; onChange?: (value: SongVisibility) => void; value?: SongVisibility | null;
}) {
  const [info, setInfo] = useState<SongVisibility | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (value) setInfo(value); }, [value]);
  useEffect(() => {
    const controller = new AbortController();
    songRequest<SongVisibility>(`/api/anisong/boards/${boardId}/visibility`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setInfo(value); onChange?.(value); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "获取公开状态失败"); });
    return () => controller.abort();
  }, [boardId]); // onChange is a notification, not a fetch dependency
  async function toggle() {
    if (!info || busy) return;
    setBusy(true); setError("");
    try {
      const result = await songRequest<SongVisibility>(`/api/anisong/boards/${boardId}/visibility`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !info.isPublic })
      });
      setInfo(result); onChange?.(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "公开状态更新失败"); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-3">
    {!info && <span className="sr-only" role="status">正在读取公开状态</span>}
    {info?.isPublic && info.templateId && <SongShareButton path={`/anisong/templates/${info.templateId}`} />}
    {showToggle && info?.canManage && <AppButton variant="ghost" size="sm" disabled={busy || disabled} onClick={() => void toggle()}>{busy ? "正在更新…" : info.isPublic ? "设为私人" : "设为公开"}</AppButton>}
    {error && <p role="alert" className="w-full text-xs text-amber-200">{error}</p>}
  </div>;
}
