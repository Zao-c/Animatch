"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { getMe, logout, type AuthUser } from "@/lib/client-api";
import { sanitizeNextPath } from "@/lib/safe-redirect";

export function AuthNav() {
  return <Suspense fallback={<span className="inline-flex min-h-11 items-center px-3 text-xs text-slate-400">正在加载账号…</span>}><AuthNavContent /></Suspense>;
}

function AuthNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [nextPath, setNextPath] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

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
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
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
  }, [pathname]);

  // Preserve the full current URL (path + query + hash) as the post-login target.
  useEffect(() => {
    function updateNextPath() {
      if (pathname === "/" || pathname === "/login") {
        setNextPath("");
        return;
      }
      const full = sanitizeNextPath(
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );
      setNextPath(full === "/" ? "" : `?next=${encodeURIComponent(full)}`);
    }
    updateNextPath();
    window.addEventListener("hashchange", updateNextPath);
    return () => window.removeEventListener("hashchange", updateNextPath);
  }, [pathname, query]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      window.location.assign("/");
    } catch {
      setLogoutError("退出失败，请检查网络后重试。");
      setIsLoggingOut(false);
    }
  }

  if (isLoading) {
    return <span role="status" className="inline-flex min-h-11 items-center px-3 text-xs text-slate-400">正在加载账号…</span>;
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
    <details
      ref={menuRef}
      className="relative min-w-0"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary
        aria-label={`账号菜单：${user.name ?? user.username ?? "我的账号"}`}
        className="flex min-h-11 max-w-[136px] cursor-pointer list-none items-center gap-2 rounded-full border border-anime-purple/25 bg-anime-purple/10 px-3 py-2 text-xs font-semibold text-purple-100 transition hover:border-anime-purple/50 hover:bg-anime-purple/20 [&::-webkit-details-marker]:hidden"
      >
        <span className="min-w-0 truncate">{user.name ?? user.username ?? "我的账号"}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-2xl border border-anime-border bg-slate-950 p-2 shadow-xl">
        <p className="break-words border-b border-white/10 px-3 py-3 text-sm font-semibold text-white">{user.name ?? user.username}</p>
        {user.username ? <Link href={`/u/${user.username}`} className="flex min-h-11 items-center rounded-xl px-3 hover:bg-white/[0.06]">我的主页</Link> : null}
        <Link href={pathname === "/account/security" ? "/account/security" : `/account/security?next=${encodeURIComponent(pathname)}`} className="flex min-h-11 items-center rounded-xl px-3 hover:bg-white/[0.06]">账号设置</Link>
        {logoutError ? <ErrorAlert message={logoutError} className="my-2" /> : null}
        <AppButton type="button" variant="quiet" onClick={handleLogout} disabled={isLoggingOut} className="w-full justify-start">
          {isLoggingOut ? "正在退出…" : "退出登录"}
        </AppButton>
      </div>
    </details>
  );
}
