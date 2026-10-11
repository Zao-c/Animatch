"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { createPool } from "@/lib/client-api";
import { QuickImportPanel } from "@/components/QuickImportPanel";

const NAME_CHIPS = ["四月新番", `${new Date().getFullYear()} 年度动画`, "恋爱番对决", "JUMP 系作品", "我的补番清单"];

export default function NewPoolPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"manual" | "bangumi">("bangumi");
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
      <section className="mx-auto max-w-6xl space-y-5">
        <header><h1 className="text-3xl font-black">创建番组</h1><p className="mt-2 text-sm text-slate-400">从 Bangumi 批量选番，或创建空番组后自行添加。</p></header>
        <nav aria-label="创建方式" className="flex gap-2 rounded-2xl border border-white/10 p-2">
          <AppButton variant={method === "bangumi" ? "secondary" : "quiet"} aria-pressed={method === "bangumi"} onClick={() => setMethod("bangumi")}>Bangumi 批量导入</AppButton>
          <AppButton variant={method === "manual" ? "secondary" : "quiet"} aria-pressed={method === "manual"} onClick={() => setMethod("manual")}>手动创建</AppButton>
        </nav>
        <div hidden={method !== "manual"}>
        <AppCard variant="focus" className="p-5 sm:p-7">
          <AppBadge tone="source">手动创建</AppBadge>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            先起一个名字
          </h2>
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
                  className="min-h-11 rounded-full border border-anime-purple/25 bg-anime-purple/10 px-4 text-xs font-semibold text-purple-100 transition hover:border-anime-pink/40 hover:bg-anime-pink/12 focus:outline-none focus:ring-2 focus:ring-anime-pink/40"
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

        </div>
        <div hidden={method !== "bangumi"}><QuickImportPanel /></div>
      </section>
    </PageShell>
  );
}
