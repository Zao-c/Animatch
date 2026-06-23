import Link from "next/link";
import Image from "next/image";
import { AuthNav } from "@/components/AuthNav";
import { NavLink } from "@/components/ui/NavLink";

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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
          <nav className="flex w-full flex-wrap items-center gap-2 text-sm text-slate-300 sm:w-auto sm:justify-end">
            <NavLink href="/pools/new">创建番组</NavLink>
            <NavLink href="/pools">我的番组</NavLink>
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
