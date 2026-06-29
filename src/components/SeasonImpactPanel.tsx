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
  const [tab, setTab] = useState<"players" | "support" | "suppress" | "keyvotes">("players");

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
        <SectionHeader eyebrow="Impact" title={isEnded ? "赛季影响分析" : "当前影响分析"} />
        <p className="mt-3 text-sm text-slate-400">
          还没有足够的投票记录，打一轮后就能看到谁在左右战局。
        </p>
      </AppCard>
    );
  }

  const isEnded = status === "ENDED";

  return (
    <AppCard className="p-6">
      <SectionHeader eyebrow="Impact" title={isEnded ? "赛季影响分析" : "当前影响分析"} />
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">
        影响力按每次投票造成的 Elo 变动量累计，用来衡量玩家对本赛季排序的推动程度；它不是作品评分，也不会替代共享 Elo。
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatMini label="总投票数" value={impact.stats.totalVotes} />
        <StatMini label="参与人数" value={impact.stats.totalParticipants} />
        <StatMini label="私心票" value={impact.stats.totalBiasVotes} />
        <StatMini label="总影响力" value={impact.stats.totalScoreSwing} />
        <StatMini label="最大推手" value={impact.stats.topInfluencerUser?.displayName ?? "-"} em />
        <StatMini label="被奶最多" value={impact.stats.mostSupportedAnime?.title ?? "-"} em />
      </div>

      {impact.currentUserImpact && impact.currentUserImpact.voteCount > 0 ? (
        <div className="mt-4 rounded-2xl border border-anime-cyan/20 bg-anime-cyan/[0.03] p-4">
          <p className="text-sm font-semibold text-anime-cyan">我的影响力</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
            <span>已投 {impact.currentUserImpact.voteCount} 票</span>
            <span>影响力 {formatImpactNumber(impact.currentUserImpact.totalScoreSwing)}</span>
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
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-sm text-slate-500">你还没有参与这个赛季。</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Season impact views">
        {(
          [
            ["players", "玩家影响力"],
            ["support", "作品支持榜"],
            ["suppress", "作品打压榜"],
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
          <p className="text-sm font-semibold text-rose-300">私心票统计</p>
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

function StatMini({ label, value, em }: { label: string; value: string | number; em?: boolean }) {
  const displayValue = typeof value === "number" ? formatImpactNumber(value) : value;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
      <p
        className={
          em
            ? "line-clamp-3 min-h-[3rem] break-words text-sm font-black leading-snug text-amber-200"
            : "text-lg font-black text-white"
        }
      >
        {displayValue}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">{label}</p>
    </div>
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
            <th className="py-2 text-right font-normal">影响力</th>
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
            <th className="py-2 text-right font-normal">打压分</th>
            <th className="py-2 text-right font-normal">次数</th>
            <th className="py-2 text-left font-normal hidden sm:table-cell">主要打压者</th>
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
          <span className="ml-auto text-xs font-semibold text-amber-200">影响力 {formatImpactNumber(v.totalSwing)}</span>
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
