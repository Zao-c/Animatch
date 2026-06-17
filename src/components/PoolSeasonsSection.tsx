"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { createSeason, getSeasons } from "@/lib/client-api";
import type { SeasonListItem } from "@/lib/client-api";

export function PoolSeasonsSection({ poolId, canEdit }: { poolId: string; canEdit?: boolean }) {
  const [seasons, setSeasons] = useState<SeasonListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    mode: "CLASSIC" as "CLASSIC" | "BIAS",
    maxVotesPerUser: 10,
    biasVotesPerUser: 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getSeasons(poolId)
      .then((data) => { setSeasons(data); setLoading(false); })
      .catch(() => { setLoading(false); });
  };

  useEffect(() => { load(); }, [poolId]);

  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createSeason(poolId, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        mode: formData.mode,
        maxVotesPerUser: formData.maxVotesPerUser,
        biasVotesPerUser: formData.mode === "BIAS" ? formData.biasVotesPerUser : undefined,
      });
      setShowForm(false);
      setFormData({ title: "", description: "", mode: "CLASSIC", maxVotesPerUser: 10, biasVotesPerUser: 3 });
      load();
    } catch (e) {
      setError("创建失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppCard className="p-5"><div className="h-16 animate-pulse rounded-xl bg-white/5" /></AppCard>;
  if (!seasons || (seasons.length === 0 && !canEdit)) return null;

  return (
    <section className="mt-8 scroll-mt-24">
      <AppCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <AppBadge tone="tier">大乱斗赛季</AppBadge>
            <p className="mt-1 text-xs leading-5 text-slate-500">多人投票赛季，独立于个人榜单</p>
          </div>
          {canEdit ? (
            <AppButton variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "取消" : "创建赛季"}
            </AppButton>
          ) : null}
        </div>

        {canEdit && showForm ? (
          <div className="mb-5 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <div className="mb-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">赛季标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder="例如：S1 赛季"
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">描述（可选）</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="赛季说明"
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">赛季模式</label>
                <div className="flex gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:border-amber-400/30 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-400/10">
                    <input
                      type="radio"
                      name="mode"
                      value="CLASSIC"
                      checked={formData.mode === "CLASSIC"}
                      onChange={() => setFormData((f) => ({ ...f, mode: "CLASSIC" }))}
                      className="sr-only"
                    />
                    传统模式
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:border-amber-400/30 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-400/10">
                    <input
                      type="radio"
                      name="mode"
                      value="BIAS"
                      checked={formData.mode === "BIAS"}
                      onChange={() => setFormData((f) => ({ ...f, mode: "BIAS" }))}
                      className="sr-only"
                    />
                    偏爱模式
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">每人最多票数</label>
                  <input
                    type="number"
                    value={formData.maxVotesPerUser}
                    onChange={(e) => setFormData((f) => ({ ...f, maxVotesPerUser: Math.max(1, Number(e.target.value)) }))}
                    min={1}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-400/50 focus:outline-none"
                  />
                </div>
                {formData.mode === "BIAS" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">每人私心票数</label>
                    <input
                      type="number"
                      value={formData.biasVotesPerUser}
                      onChange={(e) => setFormData((f) => ({ ...f, biasVotesPerUser: Math.max(1, Number(e.target.value)) }))}
                      min={1}
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-400/50 focus:outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {error ? <p className="mb-3 text-xs text-red-400">{error}</p> : null}
            <AppButton variant="primary" size="sm" onClick={handleCreate} disabled={saving || !formData.title.trim()}>
              {saving ? "创建中..." : "保存赛季"}
            </AppButton>
          </div>
        ) : null}

        {seasons.length === 0 ? (
          <p className="text-sm text-slate-500">暂无赛季，点击上方按钮创建</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {seasons.map((s) => (
              <Link
                key={s.id}
                href={`/pools/${poolId}/seasons/${s.id}`}
                className="group rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-amber-300/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white group-hover:text-amber-200">
                      {s.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <AppBadge tone={s.status === "ACTIVE" ? "success" : s.status === "ENDED" ? "muted" : "warning"}>
                        {s.status === "ACTIVE" ? "进行中" : s.status === "ENDED" ? "已结束" : "未开始"}
                      </AppBadge>
                      <AppBadge tone="source">{s.mode === "BIAS" ? "偏爱模式" : "传统模式"}</AppBadge>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{s.participantCount} 人参与</span>
                  <span>{s.totalVotes} 票</span>
                  {s.mode === "BIAS" ? <span>私心票×{s.biasVotesPerUser}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </AppCard>
    </section>
  );
}
