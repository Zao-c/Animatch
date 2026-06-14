"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { createPool } from "@/lib/client-api";

const NAME_CHIPS = ["四月新番", "2024 年度动画", "恋爱番对决", "JUMP 系作品", "我的补番清单"];

const FLOW_STEPS = [
  "创建番组",
  "添加 4-8 部动画",
  "开始对决",
  "生成 Tier List"
];

export default function NewPoolPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PRIVATE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const pool = await createPool({
        name,
        description,
        visibility
      });
      router.push(`/pools/${pool.id}#add-anime`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建番组失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyNameChip(value: string) {
    if (name.trim().length === 0) {
      setName(value);
    }
  }

  return (
    <PageShell>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <AppCard variant="focus" className="p-5 sm:p-7">
          <AppBadge tone="source">Onboarding</AppBadge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            创建你的动画池
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            先给这场对决起个名字，下一步再添加动画。
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-200">番组名</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="anime-field mt-2"
                required
                maxLength={80}
                placeholder="例如：四月新番"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {NAME_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => applyNameChip(chip)}
                  className="min-h-9 rounded-full border border-anime-purple/25 bg-anime-purple/10 px-3 text-xs font-semibold text-purple-100 transition hover:border-anime-pink/40 hover:bg-anime-pink/12"
                >
                  {chip}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-200">描述</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="anime-field mt-2 min-h-28"
                maxLength={500}
                placeholder="写一点这个池子的范围，比如补番清单、季度新番或角色偏好。"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-200">可见性</span>
              <span className="mt-2 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <input
                  type="checkbox"
                  checked={visibility === "PUBLIC"}
                  onChange={(event) => setVisibility(event.target.checked ? "PUBLIC" : "PRIVATE")}
                  className="mt-1 h-4 w-4 accent-cyan-400"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-200">公开展示</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    公开后别人可以浏览并开始自己的个人对决，但不能编辑你的番组。
                  </span>
                </span>
              </span>
            </label>

            {error ? <ErrorAlert message={error} /> : null}

            <AppButton type="submit" variant="primary" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "创建并添加动画"}
            </AppButton>
          </form>
        </AppCard>

        <AppCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-white">下一步会发生什么</h2>
            <AppBadge tone="tier">Flow</AppBadge>
          </div>
          <div className="mt-6 space-y-4">
            {FLOW_STEPS.map((step, index) => (
              <div key={step} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-anime-cyan/25 bg-anime-cyan/10 text-sm font-black text-cyan-100">
                  {index + 1}
                </span>
                <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                  <p className="text-sm font-semibold text-white">{step}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6 text-slate-400">
            建议先放入 4-8 部动画。数量足够后，AniMatch 会把它变成一场左右选择的轻竞技对决。
          </p>
        </AppCard>
      </section>
    </PageShell>
  );
}
