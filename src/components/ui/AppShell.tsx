import Link from "next/link";

export function AppShell({
  children,
  contentClassName = ""
}: Readonly<{
  children: React.ReactNode;
  contentClassName?: string;
}>) {
  return (
    <div className="anime-shell min-h-screen text-slate-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/62 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-lg font-black text-cyan-200 shadow-[0_0_30px_rgba(3,218,197,0.18)]">
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
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 transition hover:border-cyan-300/40 hover:text-white"
            >
              我的番组
            </Link>
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10 ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
}
