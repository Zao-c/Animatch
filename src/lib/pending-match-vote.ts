import type { ComparisonResult } from "./client-api";

export interface PendingMatchVote {
  version: 1;
  ownerId: string;
  poolId: string;
  runId: string;
  leftTitle: string;
  rightTitle: string;
  request: {
    leftAnimeId: string;
    rightAnimeId: string;
    result: ComparisonResult;
    clientMutationId: string;
    expectedUserId: string;
  };
}

export const VOTE_LABELS: Record<ComparisonResult, string> = {
  LEFT_WIN: "更喜欢左边", RIGHT_WIN: "更喜欢右边", DRAW: "差不多", SKIP: "跳过",
  LEFT_UNSEEN: "左边没看过", RIGHT_UNSEEN: "右边没看过", BOTH_UNSEEN: "都没看过"
};

export function pendingVoteKey(ownerId: string, poolId: string, runId: string) {
  return `animatch:pending-vote:${ownerId}:${poolId}:${runId}`;
}

export function readPendingVote(ownerId: string, poolId: string, runId: string): PendingMatchVote | null {
  const raw = sessionStorage.getItem(pendingVoteKey(ownerId, poolId, runId));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.version === 1 && value.resolved === true) return null;
  const request = value?.request;
  if (value?.version !== 1 || value.ownerId !== ownerId || value.poolId !== poolId || value.runId !== runId ||
    typeof value.leftTitle !== "string" || typeof value.rightTitle !== "string" ||
    !request || request.expectedUserId !== ownerId ||
    ![request.leftAnimeId, request.rightAnimeId, request.clientMutationId].every((part) => typeof part === "string" && part.length > 0 && part.length <= 200) ||
    request.leftAnimeId === request.rightAnimeId || !Object.prototype.hasOwnProperty.call(VOTE_LABELS, request.result)) {
    throw new Error("无法读取待确认的投票，请先查看当前榜单。当前不会自动重发。");
  }
  // Only accept the supported fields from browser storage.
  return { version: 1, ownerId, poolId, runId, leftTitle: value.leftTitle, rightTitle: value.rightTitle,
    request: { leftAnimeId: request.leftAnimeId, rightAnimeId: request.rightAnimeId, clientMutationId: request.clientMutationId, result: request.result, expectedUserId: ownerId } };
}

export function storePendingVote(vote: PendingMatchVote) {
  sessionStorage.setItem(pendingVoteKey(vote.ownerId, vote.poolId, vote.runId), JSON.stringify(vote));
}

export function clearPendingVote(ownerId: string, poolId: string, runId: string) {
  const key = pendingVoteKey(ownerId, poolId, runId);
  try { sessionStorage.removeItem(key); }
  catch { sessionStorage.setItem(key, JSON.stringify({ version: 1, resolved: true })); }
}
