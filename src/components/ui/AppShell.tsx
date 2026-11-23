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
        <div className="mx-auto grid w-full max-w-[90rem] grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-2 sm:flex sm:gap-4 sm:px-6 sm:py-3 2xl:px-8">
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
              <span className="hidden text-xs font-medium text-slate-400 sm:block">
                发现你的动画偏好
              </span>
            </span>
          </Link>
          <nav aria-label="主导航" className="order-3 col-span-2 grid grid-cols-4 gap-2 text-sm text-slate-300 [&>a]:justify-center [&>a]:px-2 sm:order-none sm:ml-auto sm:flex sm:items-center">
            <NavLink href="/pools?view=public">番组大厅</NavLink>
            <NavLink href="/pools/new">创建番组</NavLink>
            <NavLink href="/pools">我的番组</NavLink>
            <NavLink href="/collections">年度组合</NavLink>
          </nav>
          <div className="justify-self-end text-sm text-slate-300"><AuthNav /></div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={`mx-auto w-full min-w-0 max-w-[90rem] px-4 py-6 sm:px-6 lg:py-8 2xl:px-8 ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
}
