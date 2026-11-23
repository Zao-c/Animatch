"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

export function NavLink(props: ComponentProps<typeof Link>) {
  return <Suspense fallback={<NavLinkView {...props} />}><ActiveNavLink {...props} /></Suspense>;
}

function ActiveNavLink(props: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = typeof props.href === "string" ? props.href : props.href.pathname ?? "";
  const [target, query] = href.split("?");
  const targetView = new URLSearchParams(query).get("view");
  const view = searchParams.get("view")?.toLowerCase();
  const active = target === "/pools"
    ? pathname === target && (targetView ? view === targetView : !view || view === "mine")
    : pathname === target || pathname.startsWith(`${target}/`) || (target === "/tierlists" && pathname.endsWith("/tier-maker"));

  return <NavLinkView {...props} active={active} />;
}

function NavLinkView({ className = "", active = false, ...props }: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      {...props}
      aria-current={active ? "page" : undefined}
      className={[
        "inline-flex min-h-11 min-w-0 items-center whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-medium transition duration-anime",
        active ? "border-anime-purple/50 bg-anime-purple/20 text-white" : "border-white/10 bg-white/[0.04] text-slate-300",
        "hover:border-anime-purple/35 hover:bg-anime-purple/10 hover:text-white",
        "active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-anime-cyan/40",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
