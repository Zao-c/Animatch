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
        "inline-flex min-h-11 min-w-0 items-center whitespace-nowrap rounded-lg border border-transparent px-3 py-2 text-xs font-medium transition-colors duration-anime",
        active ? "bg-anime-purple/15 text-purple-100" : "text-slate-300",
        "hover:bg-white/[0.06] hover:text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anime-cyan",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
