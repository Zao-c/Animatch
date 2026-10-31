"use client";
import { useEffect, useRef, type ReactNode } from "react";
/** The native top layer escapes both card overflow and modal clipping. */
export function SongPlayerPopover({ label, children }: { label: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { const p = panel.current; p?.setAttribute("popover", "auto"); p?.removeAttribute("hidden"); return () => { if (p?.matches(":popover-open")) p.hidePopover(); }; }, []);
  function toggle() {
    const p = panel.current, button = trigger.current; if (!p || !button) return;
    if (p.matches(":popover-open")) { p.hidePopover(); return; }
    const r = button.getBoundingClientRect(), width = Math.min(320, window.innerWidth - 24);
    p.style.width = `${width}px`; p.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - width - 12))}px`;
    p.style.top = `${Math.max(12, Math.min(r.top - 250, window.innerHeight - 264))}px`; p.showPopover();
  }
  return <><button ref={trigger} type="button" onClick={toggle} aria-label={label} aria-haspopup="dialog" className="min-h-8 min-w-0 max-w-full truncate text-[10px] text-slate-300 hover:text-white">{label.startsWith("音量") ? "音量" : label}</button><div ref={panel} hidden role="dialog" aria-label={label} className="fixed m-0 max-h-60 overflow-y-auto overscroll-contain break-words rounded-xl border border-white/20 bg-slate-950 p-3 text-xs leading-6 text-slate-100 shadow-2xl">{children}</div></>;
}
