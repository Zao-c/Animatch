"use client";
import { useEffect, useRef, type ReactNode } from "react";
/** The native top layer escapes both card overflow and modal clipping. */
export function SongPlayerPopover({ label, children }: { label: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const p = panel.current, button = trigger.current;
    if (!p) return;
    p.setAttribute("popover", "auto");
    p.removeAttribute("hidden");
    const syncExpanded = () => button?.setAttribute("aria-expanded", String(p.matches(":popover-open")));
    p.addEventListener("toggle", syncExpanded);
    return () => { p.removeEventListener("toggle", syncExpanded); if (p.matches(":popover-open")) p.hidePopover(); };
  }, []);
  function toggle() {
    const p = panel.current, button = trigger.current;
    if (!p || !button) return;
    if (p.matches(":popover-open")) { p.hidePopover(); return; }
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
    const width = Math.max(140, Math.min(320, viewportWidth - 24));
    p.style.width = `${width}px`;
    p.style.maxHeight = `${Math.max(64, Math.min(240, viewportHeight - 24))}px`;
    p.style.left = `${Math.max(12, Math.min(rect.left, viewportWidth - width - 12))}px`;
    p.style.top = "12px";
    p.showPopover();
    // Measure the *actual* content, not a hard-coded 250px assumed dialog height.
    const height = p.getBoundingClientRect().height;
    const above = rect.top - height - 8, below = rect.bottom + 8;
    const top = above >= 12 ? above : below + height <= viewportHeight - 12
      ? below : Math.max(12, Math.min(rect.top, viewportHeight - height - 12));
    p.style.top = `${top}px`;
  }
  return <><button ref={trigger} type="button" onClick={toggle} aria-label={label} aria-haspopup="dialog" aria-expanded="false" className="min-h-8 min-w-0 max-w-full truncate text-[10px] text-slate-300 hover:text-white">{label.startsWith("音量") ? "音量" : label}</button><div ref={panel} hidden role="dialog" aria-label={label} className="fixed m-0 max-h-60 overflow-y-auto overscroll-contain break-words rounded-xl border border-white/20 bg-slate-950 p-3 text-xs leading-6 text-slate-100 shadow-2xl">{children}</div></>;
}
