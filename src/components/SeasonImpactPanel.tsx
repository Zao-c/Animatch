"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimeCover } from "@/components/AnimeCover";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { BattleSeasonImpact } from "@/lib/server/battle-season-impact";

interface SeasonImpactPanelProps {
  poolId: string;
  seasonId: string;
  status: string;
  fetchImpact: (poolId: string, seasonId: string) => Promise<BattleSeasonImpact>;
}

export function SeasonImpactPanel({ poolId, seasonId, status, fetchImpact }: SeasonImpactPanelProps) {
  const [impact, setImpact] = useState<BattleSeasonImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"players" | "support" | "suppress" | "keyvotes">("support");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchImpact(poolId, seasonId)
      .then((d) => { setImpact(d); setLoading(false); })
      .catch((e) => { setError(e?.message ?? "加载失败"); setLoading(false); });
  }, [poolId, seasonId, fetchImpact]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <AppCard className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-40 rounded bg-white/10" />
          <div className="h-32 rounded-2xl bg-white/5" />
        </div>
      </AppCard>
    );
  }

  if (error) {
    return (
      <AppCard className="p-6">
        <ErrorAlert message={error} />
      </AppCard>
    );
  }

  if (!impact || impact.stats.totalVotes === 0) {
    const isEnded = status === "ENDED";
    return (
      <AppCard className="p-6">
        <SectionHeader eyebrow="Season" title={isEnded ? "赛季回顾" : "赛季进行中"} />
        <p className="mt-3 text-sm text-slate-400">
          还没有投票记录。完成第一轮对决后，这里会展示当前最受支持的作品和你的参与进度。
        </p>
      </AppCard>
    );
  }

  const isEnded = status === "ENDED";

  return (
    <AppCard className="p-6">
      <SectionHeader eyebrow="Season" title={isEnded ? "赛季回顾" : "赛季进行中"} />
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">
        这里展示每张票带来的个人 Elo 变动和支持倾向，不代表社区共享榜单的排名影响；私心票只会在共享聚合时加成。
      </p>

      <SeasonStory impact={impact} />

      {impact.currentUserImpact && impact.currentUserImpact.voteCount > 0 ? (
        <div className="mt-4 border-y border-anime-cyan/20 bg-anime-cyan/[0.03] px-4 py-3">
          <p className="text-sm font-semibold text-anime-cyan">我的参与</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
            <span>已投 {impact.currentUserImpact.voteCount} 票</span>
            <span>个人 Elo 变动 {formatImpactNumber(impact.currentUserImpact.totalScoreSwing)}</span>
            {impact.currentUserImpact.biasVoteCount > 0 ? (
              <span className="text-rose-300">私心票 {impact.currentUserImpact.biasVoteCount}</span>
            ) : null}
            <span>
              排名 #
              {impact.userImpactRanking.findIndex((u) => u.userId === impact.currentUserImpact?.userId) + 1}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-y border-white/10 bg-white/[0.02] px-4 py-3">
          <p className="text-sm text-slate-500">你还没有参与这个赛季，开始对决后会显示你的参与记录。</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Season impact views">
        {(
          [
            ["support", "当前支持"],
            ["players", "玩家参与"],
            ["suppress", "较少被选择"],
            ["keyvotes", "关键投票"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-11 rounded-full border px-4 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-anime-purple/40 ${
              tab === key
                ? "border-anime-purple/50 bg-anime-purple/12 text-purple-100"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "players" ? (
          <PlayerImpactTable ranking={impact.userImpactRanking.slice(0, 10)} />
        ) : tab === "support" ? (
          <AnimeSupportTable items={impact.animeSupportRanking.slice(0, 10)} />
        ) : tab === "suppress" ? (
          <AnimeSuppressTable items={impact.animeSuppressionRanking.slice(0, 10)} />
        ) : (
          <KeyVotesTable votes={impact.keyVotes} />
        )}
      </div>

      {impact.biasVoteStats ? (
        <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/[0.03] p-4">
          <p className="text-sm font-semibold text-rose-300">私心票使用</p>
          <div className="mt-2 text-xs text-slate-400">
            {impact.biasVoteStats.totalBiasVotes} 张私心票 · {impact.biasVoteStats.biasUsersCount} 人使用
          </div>
          {impact.biasVoteStats.topBiasUsers.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {impact.biasVoteStats.topBiasUsers.slice(0, 5).map((u) => (
                <span key={u.userId} className="rounded-full border border-rose-400/30 bg-rose-400/8 px-2 py-0.5 text-[11px] text-rose-200">
                  {u.displayName} ×{u.biasCount}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 text-xs text-slate-600">本赛季还没有人使用私心票。</div>
      )}
    </AppCard>
  );
}

function SeasonStory({ impact }: { impact: BattleSeasonImpact }) {
  const supportedTitle = impact.stats.mostSupportedAnime?.title ?? "结果仍在汇总";
  const contributor = impact.stats.topInfluencerUser?.displayName ?? "暂无";

  return (
    <section className="mt-5 border-y border-white/10 py-4" aria-label="赛季当前结论">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">当前最受支持</p>
          <p className="mt-1 line-clamp-2 text-sm font-black leading-snug text-amber-100">{supportedTitle}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">个人 Elo 变动最多的玩家</p>
          <p className="mt-1 text-sm font-black text-white">{contributor}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">投票</dt>
            <dd className="mt-1 text-sm font-black text-white">{impact.stats.totalVotes}</dd>
          </div>
          <div>
            <dt className="text-slate-500">参与者</dt>
            <dd className="mt-1 text-sm font-black text-white">{impact.stats.totalParticipants}</dd>
          </div>
          <div>
            <dt className="text-slate-500">私心票</dt>
            <dd className="mt-1 text-sm font-black text-rose-200">{impact.stats.totalBiasVotes}</dd>
          </div>
        </dl>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        全部投票累计带来 {formatImpactNumber(impact.stats.totalScoreSwing)} 的个人 Elo 变动。
      </p>
    </section>
  );
}

function PlayerImpactTable({ ranking }: { ranking: NonNullable<BattleSeasonImpact>["userImpactRanking"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-slate-500">
            <th className="py-2 text-left font-normal">#</th>
            <th className="py-2 text-left font-normal">玩家</th>
            <th className="py-2 text-right font-normal">投票</th>
            <th className="py-2 text-right font-normal">私心</th>
            <th className="py-2 text-right font-normal">个人 Elo 变动</th>
            <th className="py-2 text-left font-normal hidden sm:table-cell">主要支持</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((u, idx) => (
            <tr key={u.userId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="py-2.5 font-bold text-amber-200">{idx + 1}</td>
              <td className="py-2.5 font-medium text-white/80">{u.displayName}</td>
              <td className="py-2.5 text-right text-slate-300">{u.voteCount}</td>
              <td className="py-2.5 text-right text-rose-300">{u.biasVoteCount || "-"}</td>
              <td className="py-2.5 text-right font-semibold text-amber-200">{formatImpactNumber(u.totalScoreSwing)}</td>
              <td className="py-2.5 hidden sm:table-cell">
                <div className="flex flex-wrap gap-1">
                  {u.supportedAnimeTop3.map((a) => (
                    <span key={a.animeId} className="rounded bg-anime-cyan/12 px-1.5 py-0.5 text-[10px] text-anime-cyan">
                      {a.title}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnimeSupportTable({ items }: { items: NonNullable<BattleSeasonImpact>["animeSupportRanking"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-slate-500">
            <th className="py-2 text-left font-normal">#</th>
            <th className="py-2 text-left font-normal">作品</th>
            <th className="py-2 text-right font-normal">支持分</th>
            <th className="py-2 text-right font-normal">次数</th>
            <th className="py-2 text-left font-normal hidden sm:table-cell">主要支持者</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a, idx) => (
            <tr key={a.animeId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="py-2.5 font-bold text-amber-200">{idx + 1}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-6 flex-shrink-0 overflow-hidden rounded">
                    <AnimeCover animeId={a.animeId} src={a.coverUrl} title={a.title} size="sm" fit="cover" />
                  </div>
                  <span className="truncate font-medium text-white/80">{a.title}</span>
                </div>
              </td>
              <td className="py-2.5 text-right font-semibold text-emerald-300">{formatImpactNumber(a.supportScore)}</td>
              <td className="py-2.5 text-right text-slate-400">{a.supportVoteCount}</td>
              <td className="py-2.5 hidden sm:table-cell">
                <div className="flex flex-wrap gap-1">
                  {a.topSupporters.slice(0, 3).map((s) => (
                    <span key={s.userId} className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-300">{s.displayName}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnimeSuppressTable({ items }: { items: NonNullable<BattleSeasonImpact>["animeSuppressionRanking"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-slate-500">
            <th className="py-2 text-left font-normal">#</th>
            <th className="py-2 text-left font-normal">作品</th>
            <th className="py-2 text-right font-normal">落选次数</th>
            <th className="py-2 text-right font-normal">次数</th>
            <th className="py-2 text-left font-normal hidden sm:table-cell">相关对决选择</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a, idx) => (
            <tr key={a.animeId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="py-2.5 font-bold text-amber-200">{idx + 1}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-6 flex-shrink-0 overflow-hidden rounded">
                    <AnimeCover animeId={a.animeId} src={a.coverUrl} title={a.title} size="sm" fit="cover" />
                  </div>
                  <span className="truncate font-medium text-white/80">{a.title}</span>
                </div>
              </td>
              <td className="py-2.5 text-right font-semibold text-rose-300">{formatImpactNumber(a.suppressionScore)}</td>
              <td className="py-2.5 text-right text-slate-400">{a.suppressionVoteCount}</td>
              <td className="py-2.5 hidden sm:table-cell">
                <div className="flex flex-wrap gap-1">
                  {a.topSuppressors.slice(0, 3).map((s) => (
                    <span key={s.userId} className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-300">{s.displayName}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyVotesTable({ votes }: { votes: NonNullable<BattleSeasonImpact>["keyVotes"] }) {
  if (votes.length === 0) {
    return <p className="text-sm text-slate-500">暂无关键投票。</p>;
  }
  return (
    <div className="space-y-2">
      {votes.map((v) => (
        <div key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
          <span className="text-xs text-slate-600">第 {v.stepNumber} 步</span>
          <span className="font-medium text-white/80">{v.displayName}</span>
          <span className={v.voteType === "BIAS" ? "text-rose-300" : "text-slate-400"}>
            {v.voteType === "BIAS" ? "使用私心票，让" : "选择"}
          </span>
          <span className="font-semibold text-amber-200">{v.winnerTitle}</span>
          <span className="text-slate-500">战胜</span>
          <span className="text-slate-400">{v.loserTitle}</span>
          <span className="ml-auto text-xs font-semibold text-amber-200">个人 Elo 变动 {formatImpactNumber(v.totalSwing)}</span>
          {v.voteType === "BIAS" ? (
            <span className="text-[10px] text-rose-400/70">权重 {v.weight}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function formatImpactNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";

  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1,
    minimumFractionDigits: 0
  });
}
