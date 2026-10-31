"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { AppButton } from "@/components/ui/AppButton";
/** Native modal supplies focus containment, Escape handling and focus restoration. */
export function SongEditDrawer({ children, busy, onClose }: { children: ReactNode; busy: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current; const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialog} aria-labelledby="song-editor-heading" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className="fixed inset-0 ml-auto mr-0 mt-auto flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-2xl border border-white/15 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/65 sm:my-0 sm:h-dvh sm:max-h-dvh sm:rounded-none">
    <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3"><h2 id="song-editor-heading" className="font-bold">歌曲编辑</h2><AppButton variant="quiet" size="sm" disabled={busy} onClick={onClose}>关闭编辑</AppButton></header>
    <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
  </dialog>;
}
