"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, logout, type AuthUser } from "@/lib/client-api";

export function AuthNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

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
  }, []);

  async function handleLogout() {
    await logout().catch(() => null);
    window.location.assign("/");
  }

  if (user === null) {
    const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;

    return (
      <Link
        href={`/login${next}`}
        className="min-h-11 rounded-full border border-anime-border bg-white/[0.04] px-4 py-2 transition duration-anime hover:border-anime-purple/40 hover:text-white"
      >
        登录
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={user.username ? `/u/${user.username}` : "#"}
        className="hidden max-w-[120px] truncate rounded-full border border-anime-purple/25 bg-anime-purple/10 px-3 py-2 text-xs font-semibold text-purple-100 transition hover:border-anime-purple/50 hover:bg-anime-purple/20 sm:inline"
      >
        {user.name ?? user.username}
      </Link>
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
