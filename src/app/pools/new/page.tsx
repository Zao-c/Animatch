"use client";

import { FormEvent, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { usePoolCreation } from "@/lib/use-pool-creation";
import { PoolCreationNotice } from "@/components/PoolCreationNotice";
import { QuickImportPanel } from "@/components/QuickImportPanel";

const NAME_CHIPS = ["四月新番", `${new Date().getFullYear()} 年度动画`, "恋爱番对决", "JUMP 系作品", "我的补番清单"];

export default function NewPoolPage() {
  const creation = usePoolCreation("manual");
  const [quickBusy, setQuickBusy] = useState(false);
  const [method, setMethod] = useState<"manual" | "bangumi">("bangumi");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PRIVATE");
  const isSubmitting = creation.busy;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creation.locked || quickBusy) return;
    await creation.submit({ name: name.trim(), description: description.trim(), visibility });
  }

  function applyNameChip(value: string) {
    if (name.trim().length === 0) {
      setName(value);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl space-y-5">
        <header><h1 className="text-3xl font-black">创建番组</h1></header>
        <nav aria-label="创建方式" className="flex gap-2 rounded-2xl border border-white/10 p-2">
          <AppButton variant={method === "bangumi" ? "secondary" : "quiet"} disabled={isSubmitting || quickBusy} aria-pressed={method === "bangumi"} onClick={() => setMethod("bangumi")}>Bangumi 批量导入</AppButton>
          <AppButton variant={method === "manual" ? "secondary" : "quiet"} disabled={isSubmitting || quickBusy} aria-pressed={method === "manual"} onClick={() => setMethod("manual")}>手动创建{creation.record ? creation.record.poolId ? " · 已创建" : " · 待确认" : ""}</AppButton>
        </nav>
        <div hidden={method !== "manual"}>
        <AppCard variant="focus" className="p-5 sm:p-7">
          <PoolCreationNotice creation={creation} />
          <form onSubmit={handleSubmit} className="mt-7">
          <fieldset disabled={creation.locked || quickBusy} className="space-y-5">
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


            <AppButton type="submit" variant="primary" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "创建并添加动画"}
            </AppButton>
          </fieldset>
          </form>
        </AppCard>

        </div>
        <div hidden={method !== "bangumi"}><QuickImportPanel onBusyChange={setQuickBusy} /></div>
      </section>
    </PageShell>
  );
}
