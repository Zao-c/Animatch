"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { getSeasons } from "@/lib/client-api";
import type { SeasonListItem } from "@/lib/client-api";

export function PoolSeasonsSection({ poolId }: { poolId: string }) {
  const [seasons, setSeasons] = useState<SeasonListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSeasons(poolId)
      .then((data) => { if (!cancelled) { setSeasons(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [poolId]);

  if (loading) return <AppCard className="p-5"><div className="h-16 animate-pulse rounded-xl bg-white/5" /></AppCard>;
  if (!seasons || seasons.length === 0) return null;

  return (
    <section className="mt-8 scroll-mt-24">
      <AppCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <AppBadge tone="tier">大乱斗赛季</AppBadge>
            <p className="mt-1 text-xs leading-5 text-slate-500">多人投票赛季，独立于个人榜单</p>
          </div>
        </div>
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
      </AppCard>
    </section>
  );
}
