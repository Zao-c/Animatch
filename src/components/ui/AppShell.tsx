import Link from "next/link";
import Image from "next/image";
import { AuthNav } from "@/components/AuthNav";

export function AppShell({
  children,
  contentClassName = ""
}: Readonly<{
  children: React.ReactNode;
  contentClassName?: string;
}>) {
  return (
    <div className="anime-shell min-h-screen text-slate-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/50 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="group flex items-center gap-3" aria-label="AniMatch home">
            <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-anime-pink/30 bg-slate-950 shadow-[0_16px_42px_rgba(255,122,182,0.14)] transition duration-anime group-hover:border-anime-cyan/40 group-hover:shadow-anime-focus">
              <Image
                src="/brand/animatch-logo-icon.png"
                alt=""
                width={44}
                height={44}
                priority
                className="h-full w-full object-cover"
                sizes="44px"
              />
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight text-white">
                AniMatch
              </span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-purple-200/70">
                personal anime arena
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm text-slate-300">
            <Link
              href="/pools/new"
              className="inline-flex min-h-11 items-center rounded-full border border-anime-pink/30 bg-gradient-to-r from-anime-pink/15 to-anime-amber/10 px-4 py-2 font-semibold text-white shadow-[0_0_18px_rgba(255,122,182,0.15)] transition duration-anime hover:border-anime-pink/50 hover:shadow-[0_0_28px_rgba(255,122,182,0.25)]"
            >
              创建番组
            </Link>
            <Link
              href="/pools"
              className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 font-semibold transition duration-anime hover:border-anime-purple/40 hover:bg-white/[0.06] hover:text-white"
            >
              我的番组
            </Link>
            <AuthNav />
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
}
