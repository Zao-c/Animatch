import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export default function Home() {
  return (
    <PageShell>
      <section className="grid min-h-[calc(100vh-160px)] items-center gap-10 lg:grid-cols-[1fr_420px]">
        <div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            AniMatch
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            创建自己的动画池，用两两对决生成个人 Tier List。Bangumi 数据由后端代理缓存，Elo
            更新只在服务端事务中完成。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/pools"
              className="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
            >
              进入我的番组
            </Link>
            <Link
              href="/pools/new"
              className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/10"
            >
              新建番组
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <div className="space-y-5">
            {[
              ["1", "创建番组", "搜索或批量导入 Bangumi 动画。"],
              ["2", "两两对决", "一次加载多组 pair，首批图片提前预加载。"],
              ["3", "生成 Tier List", "后端 Elo 状态实时构建 S/A/B/C/D。"]
            ].map(([step, title, body]) => (
              <div key={step} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-300 text-sm font-bold text-zinc-950">
                  {step}
                </div>
                <div>
                  <h2 className="font-semibold text-white">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
