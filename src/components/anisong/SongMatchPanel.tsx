"use client";
import type { SongDecision, SongTrack } from "@/lib/anisong/types";
import { rankSongs, nextSongPair } from "@/lib/anisong/engine";
import { MatchArena } from "@/components/MatchPresentation";
import { AppButton } from "@/components/ui/AppButton";
import { SongMatchCard } from "./SongMatchCard";
import { SongPlaybackPreferences } from "./SongPlaybackPreferences";

type Ranking = ReturnType<typeof rankSongs>;
type Pair = ReturnType<typeof nextSongPair>;
const playbackKey = (track: SongTrack) => JSON.stringify([track.id, track.source, track.itunes, track.clipStart, track.clipLength]);

export function SongMatchPanel({ boardId, pair, ranking, disabled, onVote, onLibrary, onTier }: {
  boardId: string; pair: Pair; ranking: Ranking; disabled: boolean;
  onVote: (decision: SongDecision) => void; onLibrary: () => void; onTier: () => void;
}) {
  return <section aria-label="音乐对决" className="space-y-4">
    <details className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
      <summary className="cursor-pointer text-sm text-slate-300">试听设置（音源优先级和自动切换）</summary>
      <div className="mt-3"><SongPlaybackPreferences /></div>
    </details>
    {pair ? <>
      <div className="mx-auto max-w-4xl">
        <MatchArena mode="music"
          left={<SongMatchCard key={playbackKey(pair.left)} track={pair.left} boardId={boardId} side="left" disabled={disabled} onPick={() => onVote("LEFT_WIN")} onUnheard={() => onVote("LEFT_UNSEEN")} />}
          right={<SongMatchCard key={playbackKey(pair.right)} track={pair.right} boardId={boardId} side="right" disabled={disabled} onPick={() => onVote("RIGHT_WIN")} onUnheard={() => onVote("RIGHT_UNSEEN")} />}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <AppButton variant="secondary" disabled={disabled} onClick={() => onVote("DRAW")}>一样喜欢</AppButton>
        <AppButton variant="ghost" disabled={disabled} onClick={() => onVote("SKIP")}>跳过这组</AppButton>
      </div>
      <p className="text-center text-xs leading-6 text-slate-500">
        <span className="block text-slate-400">Q / E 试听或暂停左右歌曲 · 切换试听会自动暂停另一首</span>
        ← / → 选左右 · ↑ 平局 · ↓ 跳过（也支持 1 / 2 / 3 / 4）
      </p>
    </> : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
      <p>参与对决的歌曲不足两首。</p>
      <p className="mt-2 text-sm text-slate-400">添加歌曲、调整参赛范围，或恢复「未听过」的歌曲。</p>
      <AppButton className="mt-4" onClick={onLibrary}>返回曲单管理</AppButton>
    </div>}
    <div className="rounded-2xl border border-white/10 p-4">
      <div className="flex justify-between gap-3 text-sm">
        <span>{ranking.progress.stage === "EMPTY" ? "等待开始" : ranking.progress.stageLabel}</span>
        <button type="button" className="text-anime-cyan hover:underline" onClick={onTier}>查看当前 Tier List →</button>
      </div>
      <progress aria-label="对决进度" value={ranking.progress.progressRatio} max={1} className="mt-3 h-2 w-full accent-teal-300" />
      <p className="mt-2 text-xs text-slate-400">{ranking.progress.remainingToNextStage > 0 ? "再比较 " + ranking.progress.remainingToNextStage + " 次，" + ranking.progress.nextTargetLabel + "。" : "可以继续比较，或查看榜单。"}进度是比较次数参考，不代表统计置信度。</p>
    </div>
  </section>;
}
