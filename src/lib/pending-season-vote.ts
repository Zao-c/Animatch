export interface PendingSeasonVote {
  version: 1;
  ownerId: string;
  poolId: string;
  seasonId: string;
  leftTitle: string;
  rightTitle: string;
  request: {
    leftAnimeId: string;
    rightAnimeId: string;
    winnerAnimeId: string;
    useBiasVote: boolean;
    clientMutationId: string;
    expectedUserId: string;
  };
}

export function pendingSeasonVoteKey(ownerId: string, poolId: string, seasonId: string) {
  return `animatch:pending-season-vote:${ownerId}:${poolId}:${seasonId}`;
}

export function readPendingSeasonVote(ownerId: string, poolId: string, seasonId: string): PendingSeasonVote | null {
  const raw = sessionStorage.getItem(pendingSeasonVoteKey(ownerId, poolId, seasonId));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.version === 1 && value.resolved === true) return null;
  const request = value?.request;
  if (value?.version !== 1 || value.ownerId !== ownerId || value.poolId !== poolId || value.seasonId !== seasonId ||
    ![value.leftTitle, value.rightTitle].every((title) => typeof title === "string" && title.length <= 2000) ||
    !request || request.expectedUserId !== ownerId || typeof request.useBiasVote !== "boolean" ||
    ![request.leftAnimeId, request.rightAnimeId, request.winnerAnimeId, request.clientMutationId].every((id) => typeof id === "string" && id.length > 0 && id.length <= 200) ||
    request.leftAnimeId === request.rightAnimeId || ![request.leftAnimeId, request.rightAnimeId].includes(request.winnerAnimeId)) {
    throw new Error("待确认记录无法读取。请查看赛季榜单后清除本地记录，当前不会自动重发。");
  }
  return { version: 1, ownerId, poolId, seasonId, leftTitle: value.leftTitle, rightTitle: value.rightTitle,
    request: { leftAnimeId: request.leftAnimeId, rightAnimeId: request.rightAnimeId,
      winnerAnimeId: request.winnerAnimeId, useBiasVote: request.useBiasVote,
      clientMutationId: request.clientMutationId, expectedUserId: ownerId } };
}

export function storePendingSeasonVote(vote: PendingSeasonVote) {
  sessionStorage.setItem(pendingSeasonVoteKey(vote.ownerId, vote.poolId, vote.seasonId), JSON.stringify(vote));
}

export function clearPendingSeasonVote(ownerId: string, poolId: string, seasonId: string, mutationId?: string) {
  const key = pendingSeasonVoteKey(ownerId, poolId, seasonId);
  // A late response must not remove a newer request from the same tab.
  if (mutationId) {
    const raw = sessionStorage.getItem(key);
    if (!raw || JSON.parse(raw)?.request?.clientMutationId !== mutationId) return;
  }
  try { sessionStorage.removeItem(key); }
  catch { sessionStorage.setItem(key, JSON.stringify({ version: 1, resolved: true })); }
}
