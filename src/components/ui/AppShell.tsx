import Link from "next/link";
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
      <header className="sticky top-0 z-40 border-b border-anime-border bg-slate-950/58 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-anime-pink/25 bg-anime-pink/10 text-lg font-black text-pink-100 shadow-[0_16px_42px_rgba(255,122,182,0.12)]">
              A
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
              href="/pools"
              className="min-h-11 rounded-full border border-anime-border bg-white/[0.04] px-4 py-2 transition duration-anime hover:border-anime-purple/40 hover:text-white"
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
