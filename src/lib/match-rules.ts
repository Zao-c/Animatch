import { PoolComparisonResult } from "@prisma/client";
import { makePairKey } from "./pair-key";

export interface SeenState {
  leftSeen: boolean | null;
  rightSeen: boolean | null;
}

export interface WinnerLoser {
  winnerAnimeId: string | null;
  loserAnimeId: string | null;
}

export function isEffectiveResult(result: PoolComparisonResult): boolean {
  return (
    result === PoolComparisonResult.LEFT_WIN ||
    result === PoolComparisonResult.RIGHT_WIN ||
    result === PoolComparisonResult.DRAW
  );
}

export function getSeenState(result: PoolComparisonResult): SeenState {
  switch (result) {
    case PoolComparisonResult.LEFT_WIN:
    case PoolComparisonResult.RIGHT_WIN:
    case PoolComparisonResult.DRAW:
      return { leftSeen: true, rightSeen: true };
    case PoolComparisonResult.LEFT_UNSEEN:
      return { leftSeen: false, rightSeen: true };
    case PoolComparisonResult.RIGHT_UNSEEN:
      return { leftSeen: true, rightSeen: false };
    case PoolComparisonResult.BOTH_UNSEEN:
      return { leftSeen: false, rightSeen: false };
    case PoolComparisonResult.SKIP:
      return { leftSeen: null, rightSeen: null };
  }
}

export function getWinnerLoser(
  result: PoolComparisonResult,
  leftAnimeId: string,
  rightAnimeId: string
): WinnerLoser {
  switch (result) {
    case PoolComparisonResult.LEFT_WIN:
      return { winnerAnimeId: leftAnimeId, loserAnimeId: rightAnimeId };
    case PoolComparisonResult.RIGHT_WIN:
      return { winnerAnimeId: rightAnimeId, loserAnimeId: leftAnimeId };
    case PoolComparisonResult.DRAW:
    case PoolComparisonResult.SKIP:
    case PoolComparisonResult.LEFT_UNSEEN:
    case PoolComparisonResult.RIGHT_UNSEEN:
    case PoolComparisonResult.BOTH_UNSEEN:
      return { winnerAnimeId: null, loserAnimeId: null };
  }
}

export function shouldHideAfterUnseen(unseenCount: number): boolean {
  return unseenCount >= 2;
}

export function makeQueuePairId(leftAnimeId: string, rightAnimeId: string): string {
  return `${makePairKey(leftAnimeId, rightAnimeId)}:${crypto.randomUUID()}`;
}
