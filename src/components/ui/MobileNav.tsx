"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/ui/NavLink";

type NavItem = { href: string; label: string };

export function MobileNav({ items }: { items: readonly NavItem[] }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) && menuRef.current) {
        menuRef.current.open = false;
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details
      ref={menuRef}
      className="relative xl:hidden"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-sm text-slate-200 transition-colors hover:bg-white/[0.08] [&::-webkit-details-marker]:hidden">
        菜单
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </summary>
      <nav
        aria-label="移动端主导航"
        className="absolute right-0 top-full z-50 mt-2 grid w-56 max-w-[calc(100vw-2rem)] gap-1 rounded-xl border border-white/15 bg-slate-950 p-2 shadow-xl"
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest("a") && menuRef.current) {
            menuRef.current.open = false;
          }
        }}
      >
        {items.map((item) => (
          <NavLink key={item.href} href={item.href} className="w-full justify-start">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </details>
  );
}
