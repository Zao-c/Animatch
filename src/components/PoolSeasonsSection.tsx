"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { createSeason, getSeasons } from "@/lib/client-api";
import type { SeasonListItem } from "@/lib/client-api";
import { getSeasonScheduleState } from "@/lib/season-schedule";
import { dateTimeLocalToIso } from "@/lib/date-time-local";

export function PoolSeasonsSection({ poolId, canEdit }: { poolId: string; canEdit?: boolean }) {
  const [seasons, setSeasons] = useState<SeasonListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    mode: "CLASSIC" as "CLASSIC" | "BIAS",
    startsAt: "",
    endsAt: "",
    maxVotesPerUser: 100,
    biasVotesPerUser: 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getSeasons(poolId)
      .then((data) => { setSeasons(data); setLoading(false); })
      .catch(() => {
        setLoadError("赛季暂时加载失败，请重新加载。");
        setLoading(false);
      });
  }, [poolId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createSeason(poolId, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        mode: formData.mode,
        startsAt: dateTimeLocalToIso(formData.startsAt),
        endsAt: dateTimeLocalToIso(formData.endsAt),
        maxVotesPerUser: formData.maxVotesPerUser,
        biasVotesPerUser: formData.mode === "BIAS" ? formData.biasVotesPerUser : undefined,
      });
      setShowForm(false);
      setFormData({ title: "", description: "", mode: "CLASSIC", startsAt: "", endsAt: "", maxVotesPerUser: 100, biasVotesPerUser: 3 });
      load();
    } catch (e) {
      setError("创建失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppCard className="p-5"><div className="h-16 animate-pulse rounded-xl bg-white/5" /></AppCard>;
  if (!seasons) {
    if (!loadError) return null;
    return (
      <section id="battle-seasons" className="mt-6 scroll-mt-24 sm:scroll-mt-32">
        <AppCard className="p-5" variant="focus">
          <p className="text-sm text-amber-100">{loadError}</p>
          <AppButton className="mt-3" variant="secondary" size="md" onClick={load}>
            重新加载赛季
          </AppButton>
        </AppCard>
      </section>
    );
  }
  if (seasons.length === 0 && !canEdit) return null;

  return (
    <section id="battle-seasons" className="mt-6 scroll-mt-24 sm:scroll-mt-32">
      <AppCard className="p-5" variant="focus">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <AppBadge tone="tier">赛季大乱斗</AppBadge>
            <h2 className="mt-2 text-xl font-black text-white">限定票数赛季</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              用独立赛季 Elo 生成个人赛季 Tier List，再匿名聚合成赛季共享榜；私心票只在赛季共享榜里加成。
            </p>
          </div>
          {canEdit ? (
            <AppButton variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "取消" : "创建赛季"}
            </AppButton>
          ) : null}
        </div>

        {loadError ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
            <span>{loadError}</span>
            <AppButton variant="quiet" size="sm" onClick={load}>重新加载</AppButton>
          </div>
        ) : null}

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
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-slate-300">开放时间（可选）</span>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData((f) => ({ ...f, startsAt: e.target.value }))}
                    className="min-h-11 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white focus:border-amber-400/50 focus:outline-none"
                  />
                  <span className="text-xs leading-5 text-slate-500">留空表示发布后立即开放。</span>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold text-slate-300">投票截止（可选）</span>
                  <input
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={(e) => setFormData((f) => ({ ...f, endsAt: e.target.value }))}
                    className="min-h-11 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white focus:border-amber-400/50 focus:outline-none"
                  />
                  <span className="text-xs leading-5 text-slate-500">留空表示由管理员手动结束赛季。</span>
                </label>
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
            {seasons.map((season) => <SeasonListCard key={season.id} poolId={poolId} season={season} />)}
          </div>
        )}
      </AppCard>
    </section>
  );
}

function SeasonListCard({ poolId, season }: { poolId: string; season: SeasonListItem }) {
  const state = getSeasonListDisplayState(season);

  return (
    <Link
      href={`/pools/${poolId}/seasons/${season.id}`}
      className="group rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-amber-300/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white group-hover:text-amber-200">{season.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <AppBadge tone={state.tone}>{state.label}</AppBadge>
            <AppBadge tone="source">{season.mode === "BIAS" ? "加成票模式" : "标准对决"}</AppBadge>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{state.description}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
        <span>{season.participantCount} 人参与</span>
        <span>{season.totalVotes} 票</span>
        {season.mode === "BIAS" ? <span>加成票 {season.biasVotesPerUser} 张</span> : null}
      </div>
      <div className="mt-4 inline-flex min-h-9 items-center rounded-full border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-semibold text-amber-100 transition group-hover:border-amber-200/50 group-hover:bg-amber-300/15">
        {state.canVote ? "进入对决" : "查看赛季结果"}
      </div>
    </Link>
  );
}

function getSeasonListDisplayState(season: SeasonListItem) {
  const schedule = getSeasonScheduleState(season);
  if (schedule.phase === "ENDED") return { label: "已结束", description: "结果已定格，可查看个人和共享榜单。", tone: "muted" as const, canVote: false };
  if (schedule.phase === "DRAFT" || schedule.phase === "UPCOMING") return { label: "未开始", description: "赛季尚未开放投票。", tone: "warning" as const, canVote: false };
  if (schedule.phase === "CLOSED") return { label: "投票已截止", description: "投票已停止，可查看当前赛季结果。", tone: "muted" as const, canVote: false };
  return { label: "开放中", description: season.endsAt ? `可以投票，截止到 ${new Date(season.endsAt).toLocaleDateString("zh-CN")}。` : "现在可以开始对决。", tone: "success" as const, canVote: schedule.canVote };
}
