import { HomeActions } from "@/components/HomeActions";
import { HomeMiniMatchDemo } from "@/components/home/HomeMiniMatchDemo";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import Link from "next/link";
import { appButtonClasses } from "@/components/ui/AppButton";

const STEPS = [
  {
    step: "01",
    title: "浏览公开番组",
    body: "先看公开番组，或直接体验官方 Demo。"
  },
  {
    step: "02",
    title: "开始个人对决",
    body: "登录后选择更喜欢的作品，结果只属于你。"
  },
  {
    step: "03",
    title: "创建自己的番组",
    body: "添加作品，也可以用中文标签二次检索。"
  },
  {
    step: "04",
    title: "分享 Tier List",
    body: "生成榜单后，可以导出图片或分享链接。"
  }
];

export default function Home() {
  return (
    <PageShell>
      <section className="grid items-center gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:py-7">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="source">Manami 本地库</AppBadge>
            <AppBadge tone="tier">TierMaker PNG</AppBadge>
            <AppBadge tone="status">公开分享</AppBadge>
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            用左右选择，生成你的动画 Tier List
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            添加几部动画，通过两两对决快速排出你的个人榜单。可以导出图片，也可以生成公开分享链接。
          </p>
          <div className="mt-7">
            <HomeActions />
          </div>
        </div>

        <HomeMiniMatchDemo />
      </section>

      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <AppBadge tone="status">新手说明</AppBadge>
          <h2 className="text-lg font-semibold text-white">怎么玩 AniMatch</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item, index) => (
            <AppCard key={item.step} variant={index === 1 ? "focus" : "soft"} className="p-4">
              <div className="flex items-center gap-3">
                <AppBadge tone={index === 1 ? "status" : "muted"}>{item.step}</AppBadge>
                <h2 className="text-base font-semibold text-white">{item.title}</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.body}</p>
            </AppCard>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <AppCard className="p-5" variant="focus">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <AppBadge tone="source">官方 Demo</AppBadge>
                先看看别人怎么玩
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                访问 AniMatch 入门体验池，不用登录也能看到公开番组和 Demo 作品墙。
              </p>
            </div>
            <Link
              href="/pools?view=public"
              className={appButtonClasses({ variant: "primary", size: "md", className: "shrink-0" })}
            >
              浏览公开番组
            </Link>
          </div>
        </AppCard>
      </section>

      <section className="mt-7 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <AppCard className="p-5">
          <h2 className="text-lg font-semibold text-white">封面优先，选择更快</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            AniMatch 的核心不是管理数据，而是让动画封面、对决状态和最终榜单成为主角。
            搜索、上传、校准和显示修正会保留，但不会抢走首屏主动作。
          </p>
        </AppCard>
        <AppCard className="p-5" variant="soft">
          <h2 className="text-lg font-semibold text-white">轻竞技，不是后台</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            首页只解释下一步：浏览番组、开始对决、创建自己的番组、生成榜单。高级功能留在对应流程里渐进展开。
          </p>
        </AppCard>
      </section>
    </PageShell>
  );
}
