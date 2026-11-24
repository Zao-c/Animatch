import Link from "next/link";
import { HomeActions } from "@/components/HomeActions";
import { HomeMiniMatchDemo } from "@/components/home/HomeMiniMatchDemo";
import { HomeFeaturedShowcase } from "@/components/home/HomeFeaturedShowcase";
import { PageShell } from "@/components/PageShell";

export default function Home() {
  return (
    <PageShell contentClassName="pb-16">
      <section className="grid items-center gap-8 border-b border-white/[0.06] pb-10 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12 lg:py-8">
        <div className="min-w-0">
          <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl">
            AniMatch
          </h1>
          <p className="mt-3 max-w-md text-base text-zinc-400 sm:text-lg">
            两两对决，排出你的番剧与动画音乐榜单。
          </p>

          <div className="mt-7">
            <HomeActions />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
            <Link href="/pools/new" className="transition-colors hover:text-zinc-200">
              创建番组
            </Link>
            <Link href="/collections" className="transition-colors hover:text-zinc-200">
              年度组合
            </Link>
            <Link href="/tierlists" className="transition-colors hover:text-zinc-200">
              Tier List
            </Link>
          </div>
        </div>

        <HomeMiniMatchDemo />
      </section>

      <HomeFeaturedShowcase />
    </PageShell>
  );
}
