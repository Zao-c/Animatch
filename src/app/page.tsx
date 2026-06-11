import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { appButtonClasses } from "@/components/ui/AppButton";
import { SectionHeader } from "@/components/ui/SectionHeader";

const FEATURES = [
  {
    title: "本地动画库",
    body: "Manami 离线数据优先，Bangumi 只作为可选外部导入。",
    accent: "Library"
  },
  {
    title: "两两对决",
    body: "用少量选择把主观偏好转成稳定排序，不需要一次性给所有作品打分。",
    accent: "VS"
  },
  {
    title: "Tier List",
    body: "根据个人对决生成 S/A/B/C/D，并保留手动最终设定。",
    accent: "Tier"
  },
  {
    title: "手动修正显示",
    body: "在单个番组内改标题、封面、类型和标签，不污染公共元数据。",
    accent: "Edit"
  }
];

const STATUS = ["Manami 本地库", "中文搜索", "个人番组"];
const COMING_SOON = ["账号系统", "分享榜单", "推荐系统"];

export default function Home() {
  return (
    <PageShell>
      <section className="grid min-h-[calc(100vh-180px)] items-center gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <AppBadge tone="source">Local-first anime ranking</AppBadge>
          <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white sm:text-7xl">
            AniMatch
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            创建自己的动画番组池，用两两对决生成个人 Tier List。搜索、添加、显示修正都可以在本地动画库主流程里完成。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/pools/new" className={appButtonClasses({ variant: "primary", size: "lg" })}>
              开始创建番组
            </Link>
            <Link href="/pools" className={appButtonClasses({ variant: "ghost", size: "lg" })}>
              查看我的番组
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {STATUS.map((item) => (
              <AppBadge key={item} tone="success">
                {item}
              </AppBadge>
            ))}
          </div>
        </div>

        <AppCard className="overflow-hidden p-6">
          <div className="rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/12 via-purple-300/10 to-transparent p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-cyan-100">今日入口</span>
              <AppBadge tone="tier">MVP</AppBadge>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {["Search", "Match", "Tier", "Edit"].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-950/44 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                  <div className="text-2xl font-black text-white">{item}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    ready
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AppCard>
      </section>

      <section className="mt-6">
        <SectionHeader
          eyebrow="Workflow"
          title="从动画池到个人榜单"
          description="保留 MVP 的功能密度，但把主要入口整理成更适合日常使用的 dashboard。"
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => (
            <AppCard key={feature.title} className="p-5">
              <div className="mb-5 inline-flex rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                {feature.accent}
              </div>
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{feature.body}</p>
            </AppCard>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <AppCard className="p-6">
          <SectionHeader
            eyebrow="Coming soon"
            title="下一阶段只展示，不在本轮实现"
            description="账号、分享和推荐系统还不是当前提交范围，本轮只建立视觉基础。"
            action={
              <div className="flex flex-wrap gap-2">
                {COMING_SOON.map((item) => (
                  <AppBadge key={item} tone="muted">
                    {item}
                  </AppBadge>
                ))}
              </div>
            }
          />
        </AppCard>
      </section>
    </PageShell>
  );
}
