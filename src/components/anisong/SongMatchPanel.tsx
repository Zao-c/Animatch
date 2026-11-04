"use client";
import type { SongDecision, SongTrack, SongDocument } from "@/lib/anisong/types";
import { quickMatchProgress } from "@/lib/anisong/quick-match";
import { rankSongs, nextSongPair } from "@/lib/anisong/engine";
import { MatchArena, MatchActionBar } from "@/components/MatchPresentation";
import { MatchSessionGoal } from "@/components/MatchSessionGoal";
import { RankingProgressCard } from "@/components/RankingProgressCard";
import { AppButton } from "@/components/ui/AppButton";
import { SongMatchCard } from "./SongMatchCard";

type Ranking = ReturnType<typeof rankSongs>;
type Pair = ReturnType<typeof nextSongPair>;
const playbackKey = (track: SongTrack) => JSON.stringify([track.id, track.source, track.itunes, track.clipStart, track.clipLength]);

export function SongMatchPanel({ boardId, pair, ranking, document, disabled, busy, notice, onVote, onModeChange, onLibrary, onTier }: {
  boardId: string; pair: Pair; ranking: Ranking; document: SongDocument; disabled: boolean; busy?: boolean; notice?: string;
  onVote: (decision: SongDecision) => void; onModeChange: (mode: "classic" | "quick") => void; onLibrary: () => void; onTier: () => void;
}) {
  const isQuick = document.matchMode === "quick";
  const quick = quickMatchProgress(ranking.active, document.events);
  return <section aria-label="音乐对决">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/20 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="对决模式">
        <span className="mr-1 text-xs text-slate-400">对决模式</span>
        <AppButton size="sm" variant={isQuick ? "primary" : "ghost"} disabled={disabled} onClick={() => onModeChange("quick")}>快速分档</AppButton>
        <AppButton size="sm" variant={!isQuick ? "primary" : "ghost"} disabled={disabled} onClick={() => onModeChange("classic")}>经典 Elo</AppButton>
      </div>
      <p className="text-xs text-slate-400">{isQuick
        ? `基础覆盖 ${quick.covered}/${quick.total} · 连通分组 ${quick.components} · 建议预算约 ${quick.suggestedBudget} 场`
        : "经典模式持续优化歌曲的相对顺序"}</p>
    </div>
    {isQuick && <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-anime-cyan/25 bg-anime-cyan/[0.05] px-4 py-3 text-xs">
      <span>{quick.readyForDraft ? "基础覆盖已完成，可以查看快速初稿；仍可继续校准档位。" :
        "正在优先覆盖未充分比较的歌曲，连接不同歌曲组。"} 跳过、没听过不计入有效覆盖。</span>
      <AppButton size="sm" variant="quiet" onClick={onTier}>查看当前 Tier →</AppButton>
    </div>
    <MatchSessionGoal scopeKey={"anisong:" + boardId} count={ranking.progress.effectiveComparisons} resultHref={"/anisong/" + boardId + "/tier"} disabled={disabled} />
    <div role="status" aria-live="polite" aria-atomic="true" className="mb-2 min-h-6 text-center text-sm text-cyan-100">{busy ? "正在保存选择…" : notice || "先试听，再点击封面选出更喜欢的一首"}</div>
    {pair ? <>
      <MatchArena mode="music"
        left={<SongMatchCard key={playbackKey(pair.left)} track={pair.left} boardId={boardId} side="left" disabled={disabled} onPick={() => onVote("LEFT_WIN")} />}
        right={<SongMatchCard key={playbackKey(pair.right)} track={pair.right} boardId={boardId} side="right" disabled={disabled} onPick={() => onVote("RIGHT_WIN")} />}
      />
      <MatchActionBar columnsClassName="grid-cols-2 lg:grid-cols-4" hint="跳过不计分；没听过的歌曲从本轮隐藏，不进入你的 Tier List，可在曲单中恢复。">
        <AppButton variant="ghost" disabled={disabled} onClick={() => onVote("DRAW")}><kbd aria-hidden="true">↑</kbd><span className="ml-2">差不多</span></AppButton>
        <AppButton variant="ghost" disabled={disabled} onClick={() => onVote("SKIP")}><kbd aria-hidden="true">↓</kbd><span className="ml-2">跳过 / 换一组</span></AppButton>
        <AppButton variant="quiet" disabled={disabled} onClick={() => onVote("LEFT_UNSEEN")}>左边没听过</AppButton>
        <AppButton variant="quiet" disabled={disabled} onClick={() => onVote("RIGHT_UNSEEN")}>右边没听过</AppButton>
      </MatchActionBar>
    </> : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
      <p>参与对决的歌曲不足两首。</p>
      <p className="mt-2 text-sm text-slate-400">添加歌曲、调整参赛范围，或恢复「未听过」的歌曲。</p>
      <AppButton className="mt-4" onClick={onLibrary}>返回曲单管理</AppButton>
    </div>}
    <details className="mt-3 rounded-xl border border-white/10 px-3 text-sm text-slate-400">
      <summary className="min-h-11 cursor-pointer py-3">进度与榜单说明</summary>
      <div className="pb-3"><RankingProgressCard progress={ranking.progress} compact /><p className="mt-2 text-xs leading-6 text-slate-500">进度是比较次数参考，不代表统计置信度。未听过的歌曲不会进入榜单，也不计入本轮目标。</p><button type="button" className="mt-2 min-h-11 text-anime-cyan hover:underline" onClick={onTier}>查看当前 Tier List →</button></div>
    </details>
  </section>;
}
