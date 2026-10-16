"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, logout, type AuthUser } from "@/lib/client-api";
import { sanitizeNextPath } from "@/lib/safe-redirect";

export function AuthNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [nextPath, setNextPath] = useState("");

  // Re-sync on navigation so a client-side login (router.replace + refresh)
  // updates the nav immediately, without forcing a full page reload.
  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Preserve the full current URL (path + query + hash) as the post-login target.
  useEffect(() => {
    if (pathname === "/" || pathname === "/login") {
      setNextPath("");
      return;
    }

    const full = sanitizeNextPath(
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    setNextPath(full === "/" ? "" : `?next=${encodeURIComponent(full)}`);
  }, [pathname]);

  async function handleLogout() {
    await logout().catch(() => null);
    window.location.assign("/");
  }

  if (user === null) {
    return (
      <Link
        href={`/login${nextPath}`}
        className="inline-flex min-h-11 items-center rounded-full border border-anime-border bg-white/[0.04] px-4 py-2 transition duration-anime hover:border-anime-purple/40 hover:text-white"
      >
        登录
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={user.username ? `/u/${user.username}` : "#"}
        className="inline-flex min-h-11 max-w-[96px] items-center truncate rounded-full border border-anime-purple/25 bg-anime-purple/10 px-4 py-2 text-xs font-semibold text-purple-100 transition hover:border-anime-purple/50 hover:bg-anime-purple/20 focus:outline-none focus:ring-2 focus:ring-anime-purple/40 sm:inline-flex"
      >
        {user.name ?? user.username}
      </Link>
      <Link href={pathname === "/account/security" ? "/account/security" : `/account/security?next=${encodeURIComponent(pathname)}`} className="inline-flex min-h-11 items-center text-xs text-slate-300">账号设置</Link>
      <button
        type="button"
        onClick={handleLogout}
        className="min-h-11 rounded-full border border-anime-border bg-white/[0.04] px-4 py-2 transition duration-anime hover:border-anime-pink/40 hover:text-white"
      >
        退出
      </button>
    </div>
  );
}
