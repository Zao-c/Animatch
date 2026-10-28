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
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-anime-cyan focus:px-4 focus:py-3 focus:text-slate-950">跳到主要内容</a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/50 backdrop-blur-2xl">
        <div className="mx-auto grid w-full max-w-[90rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 sm:py-3 xl:flex xl:gap-4 2xl:px-8">
          <Link href="/" className="group flex min-w-0 items-center gap-2 sm:gap-3" aria-label="AniMatch 首页">
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
            </span>
          </Link>
          <nav aria-label="主导航" className="order-3 col-span-2 grid min-w-0 grid-cols-5 gap-1 text-xs text-slate-300 [&_a]:justify-center [&_a]:px-1 sm:gap-2 sm:text-sm xl:order-none xl:ml-auto xl:flex xl:items-center xl:[&_a]:px-4">
            <NavLink href="/pools?view=public">番组大厅</NavLink>
            <NavLink href="/pools/new">创建番组</NavLink>
            <NavLink href="/pools">我的番组</NavLink>
            <NavLink href="/collections">年度组合</NavLink>
            <NavLink href="/tierlists">Tier List</NavLink>
          </nav>
          <div className="min-w-0 justify-self-end text-sm text-slate-300"><AuthNav /></div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={`mx-auto w-full min-w-0 max-w-[90rem] px-4 py-6 sm:px-6 lg:py-8 2xl:px-8 ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
}
