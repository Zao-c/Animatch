"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSeasons, type SeasonListItem } from "@/lib/client-api";
import { getSeasonScheduleState } from "@/lib/season-schedule";
import { AppButton, appButtonClasses } from "./ui/AppButton";

export function SeasonPlayEntry({ poolId, canPlay, onBrowse }: {
  poolId: string;
  canPlay: boolean;
  onBrowse: () => void;
}) {
  const [seasons, setSeasons] = useState<SeasonListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setSeasons(await getSeasons(poolId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, [poolId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  const openSeasons = seasons.filter((season) => getSeasonScheduleState(season, now).canVote)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  const selected = openSeasons.find((season) => season.id === selectedId) ?? openSeasons[0];
  const matchPath = selected ? `/pools/${poolId}/seasons/${selected.id}/match` : "";

  return (
    <section aria-label="参与赛季投票" className="col-span-2 min-w-0 rounded-xl border border-anime-cyan/35 bg-anime-cyan/[0.06] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-cyan-100">赛季投票</h2>
        <button type="button" onClick={onBrowse} className="min-h-9 shrink-0 px-2 text-xs text-slate-300 underline decoration-slate-500/50 underline-offset-4 hover:text-white">全部赛季 →</button>
      </div>
      {loading ? <p role="status" className="py-3 text-sm text-slate-400">正在寻找开放的赛季…</p> : failed ? (
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-400">暂时没能加载赛季</p><AppButton variant="secondary" size="sm" onClick={load}>重新加载</AppButton></div>
      ) : selected ? (
        <>
          {openSeasons.length > 1 ? (
            <select aria-label="选择投票赛季" className="anime-field mb-2 min-w-0 text-sm" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
              {openSeasons.map((season) => <option key={season.id} value={season.id}>{season.title}</option>)}
            </select>
          ) : <p className="mb-2 truncate text-sm font-semibold text-white" title={selected.title}>{selected.title}</p>}
          <Link href={canPlay ? matchPath : `/login?next=${encodeURIComponent(matchPath)}`} className={appButtonClasses({ variant: "primary", size: "lg", className: "w-full" })}>
            {canPlay ? "参与赛季投票 →" : "登录并参与赛季投票 →"}
          </Link>
          <p className="mt-2 text-xs text-slate-400">{selected.participantCount} 人参与 · {selected.totalVotes} 票 · 选出你更喜欢的作品</p>
        </>
      ) : (
        <><p className="mb-2 text-xs text-slate-400">暂时没有开放投票的赛季</p><AppButton variant="secondary" className="w-full" onClick={onBrowse}>查看赛季与结果</AppButton></>
      )}
    </section>
  );
}
