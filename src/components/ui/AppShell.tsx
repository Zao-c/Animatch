import Link from "next/link";
import Image from "next/image";
import { AuthNav } from "@/components/AuthNav";
import { NavLink } from "@/components/ui/NavLink";
import { MobileNav } from "@/components/ui/MobileNav";

const MAIN_NAV_ITEMS = [
  { href: "/pools?view=public", label: "番组大厅" },
  { href: "/pools/new", label: "创建番组" },
  { href: "/pools", label: "我的番组" },
  { href: "/collections", label: "年度组合" },
  { href: "/tierlists", label: "Tier List" },
  { href: "/anisong", label: "音乐对决" }
] as const;

export function AppShell({
  children,
  contentClassName = ""
}: Readonly<{
  children: React.ReactNode;
  contentClassName?: string;
}>) {
  return (
    <div className="anime-shell min-h-screen text-zinc-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-zinc-100 focus:px-4 focus:py-3 focus:text-zinc-950">跳到主要内容</a>
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0c0d10]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[90rem] items-center gap-3 px-4 py-2 sm:px-6 sm:py-3 xl:gap-4 2xl:px-8">
          <Link href="/" className="group flex min-w-0 items-center gap-2 sm:gap-3" aria-label="AniMatch 首页">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#14161b] transition duration-anime group-hover:border-white/25">
              <Image
                src="/brand/animatch-logo-icon.png"
                alt=""
                width={40}
                height={40}
                priority
                className="h-full w-full object-cover"
                sizes="40px"
              />
            </span>
            <span>
              <span className="hidden text-lg font-semibold tracking-tight text-white sm:block">
                AniMatch
              </span>
            </span>
          </Link>
          <nav aria-label="主导航" className="hidden min-w-0 text-sm text-zinc-400 xl:ml-auto xl:flex xl:items-center xl:gap-1">
            {MAIN_NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href}>{item.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm text-zinc-300 xl:ml-0">
            <MobileNav items={MAIN_NAV_ITEMS} />
            <AuthNav />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={`mx-auto w-full min-w-0 max-w-[90rem] px-4 py-6 sm:px-6 lg:py-8 2xl:px-8 ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
}
