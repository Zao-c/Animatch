"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { AppButton } from "@/components/ui/AppButton";
/** One task surface; native modal owns focus containment and return focus. */
export function SongEditDrawer({ children, title = "批量编辑歌曲", busy, dirty, onDirtyChange, onClose }: { children: ReactNode; title?: string; busy: boolean; dirty?: boolean; onDirtyChange?: (dirty: boolean) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), changed = useRef(false); const heading = useId();
  useEffect(() => {
    const element = dialog.current; const opener = document.activeElement as HTMLElement | null; const songId = opener?.dataset.songManage; const overflow = document.body.style.overflow, padding = document.body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + gutter}px`;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; document.body.style.paddingRight = padding;
      requestAnimationFrame(() => {
        const target = opener?.isConnected ? opener : songId ? Array.from(document.querySelectorAll<HTMLElement>("[data-song-manage]")).find(button => button.dataset.songManage === songId) : null;
        target?.focus({ preventScroll: true });
      });
    };
  }, []);
  useEffect(() => { if (dirty === false) changed.current = false; }, [dirty, title]);
  function close() { if (busy) return; if ((dirty || changed.current) && !window.confirm("放弃未保存的修改或待导入内容？")) return; onClose(); }
  function change() { changed.current = true; onDirtyChange?.(true); }
  return <dialog ref={dialog} aria-labelledby={heading} onCancel={e => { e.preventDefault(); close(); }} className="fixed inset-0 ml-auto mr-0 mt-auto flex max-h-[94dvh] w-full max-w-xl flex-col rounded-t-2xl border border-white/15 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/65 sm:my-0 sm:h-dvh sm:max-h-dvh sm:rounded-none">
    <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3"><h2 id={heading} className="font-bold">{title}</h2><AppButton variant="quiet" size="sm" disabled={busy} onClick={close}>关闭任务</AppButton></header>
    <div onChange={change} onDrop={change} onClick={event => { if (event.target instanceof Element && event.target.closest("[data-dirties]")) change(); }} className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
  </dialog>;
}
