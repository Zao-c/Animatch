import { HomeActions } from "@/components/HomeActions";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";

const STEPS = [
  {
    step: "01",
    title: "添加动画",
    body: "从 Manami 本地库搜索，或放入自定义图片池。"
  },
  {
    step: "02",
    title: "开始对决",
    body: "每轮只在左右两部动画之间做一次选择。"
  },
  {
    step: "03",
    title: "生成榜单",
    body: "得到个人 Tier List，导出图片或生成公开分享链接。"
  }
];

const DEMO_COVERS = [
  {
    title: "星海列车",
    meta: "TV / 2024",
    gradient: "from-anime-pink via-fuchsia-500 to-slate-950",
    mark: "S"
  },
  {
    title: "夏日回声",
    meta: "Movie / 2023",
    gradient: "from-anime-purple via-sky-500 to-slate-950",
    mark: "A"
  }
];

export default function Home() {
  return (
    <PageShell>
      <section className="grid items-center gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:py-7">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="source">Manami 全量库</AppBadge>
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

        <MiniMatchDemo />
      </section>

      <section className="mt-7">
        <div className="grid gap-3 md:grid-cols-3">
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

      <section className="mt-7 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <AppCard className="p-5">
          <h2 className="text-lg font-semibold text-white">封面优先，选择更快</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            AniMatch 的核心不是管理数据，而是让动画封面、对决状态和最终榜单成为主角。搜索、上传、校准和显示修正会保留，但不会抢走首屏主动作。
          </p>
        </AppCard>
        <AppCard className="p-5" variant="soft">
          <h2 className="text-lg font-semibold text-white">轻竞技，不是后台</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            首页只解释下一步：添加动画、开始对决、生成榜单。高级功能留在对应流程里渐进展开。
          </p>
        </AppCard>
      </section>
    </PageShell>
  );
}

function MiniMatchDemo() {
  return (
    <AppCard variant="focus" className="overflow-hidden p-4 sm:p-5" aria-label="mini match demo">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Mini match demo
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">本轮你更想推荐哪部？</h2>
        </div>
        <AppBadge tone="warning">VS</AppBadge>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center gap-3">
        <DemoCoverCard cover={DEMO_COVERS[0]} side="left" />
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-anime-amber/35 bg-anime-amber/10 text-sm font-black text-amber-100 shadow-anime-amber">
          VS
        </div>
        <DemoCoverCard cover={DEMO_COVERS[1]} side="right" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {["左边", "差不多", "右边"].map((label, index) => (
          <button
            key={label}
            type="button"
            className={[
              "min-h-11 rounded-xl border px-2 text-sm font-semibold transition duration-anime active:scale-[0.98]",
              index === 1
                ? "border-anime-purple/30 bg-anime-purple/10 text-purple-100 hover:bg-anime-purple/16"
                : "border-anime-cyan/25 bg-anime-cyan/10 text-cyan-100 hover:bg-anime-cyan/16"
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>
    </AppCard>
  );
}

function DemoCoverCard({
  cover,
  side
}: {
  cover: (typeof DEMO_COVERS)[number];
  side: "left" | "right";
}) {
  return (
    <div className="min-w-0">
      <div
        className={`aspect-[3/4] overflow-hidden rounded-anime border border-white/12 bg-gradient-to-br ${cover.gradient} shadow-anime-panel`}
      >
        <div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.24),transparent_28%),linear-gradient(to_top,rgba(2,6,23,0.86),transparent_58%)] p-3">
          <span className="w-fit rounded-full border border-white/20 bg-slate-950/30 px-2 py-1 text-xs font-black text-white">
            {cover.mark}
          </span>
          <div>
            <p className="line-clamp-2 text-sm font-bold leading-5 text-white">{cover.title}</p>
            <p className="mt-1 text-xs text-slate-300">{cover.meta}</p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-slate-400">
        {side === "left" ? "左候选" : "右候选"}
      </p>
    </div>
  );
}
