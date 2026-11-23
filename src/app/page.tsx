import { HomeActions } from "@/components/HomeActions";
import { HomeMiniMatchDemo } from "@/components/home/HomeMiniMatchDemo";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";

const STEPS = [
  {
    step: "01",
    title: "添加动画",
    body: "从公开番组开始，或创建自己的作品池。"
  },
  {
    step: "02",
    title: "开始对决",
    body: "用左右选择快速完成一轮偏好判断。"
  },
  {
    step: "03",
    title: "生成榜单",
    body: "得到个人 Tier List，并可导出或分享。"
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
            添加几部动画，通过两两对决快速排出你的个人榜单。封面优先、选择更快，最后可以导出图片或生成公开分享链接。
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            从公开番组体验一次大乱斗，或创建自己的番组开始私人排序。
          </p>
          <div className="mt-7">
            <HomeActions />
          </div>
        </div>

        <HomeMiniMatchDemo />
      </section>

      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <AppBadge tone="status">Quick start</AppBadge>
          <h2 className="text-lg font-semibold text-white">三步生成榜单</h2>
        </div>
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-3">
          {STEPS.map((item, index) => (
            <div
              key={item.step}
              className={`rounded-xl px-3 py-3 transition duration-anime ${
                index === 1 ? "bg-anime-purple/10 ring-1 ring-anime-purple/25" : "bg-slate-950/24"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    index === 1 ? "bg-anime-purple text-slate-950" : "bg-white/[0.06] text-slate-300"
                  }`}
                >
                  {item.step}
                </span>
                <h2 className="text-sm font-semibold text-white">{item.title}</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
