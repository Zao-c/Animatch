export type TierShareRunGroup<T extends { runId: string }> = {
  runId: string;
  latest: T;
  history: T[];
};

/**
 * Shares must be passed newest first. Each snapshot remains accessible:
 * the most recent one is prominent, and earlier links become history.
 */
export function groupTierSharesByRun<T extends { runId: string }>(
  shares: readonly T[]
): TierShareRunGroup<T>[] {
  const groups: TierShareRunGroup<T>[] = [];
  const byRun = new Map<string, TierShareRunGroup<T>>();

  for (const share of shares) {
    const existing = byRun.get(share.runId);
    if (existing) {
      existing.history.push(share);
    } else {
      const group = { runId: share.runId, latest: share, history: [] as T[] };
      byRun.set(share.runId, group);
      groups.push(group);
    }
  }

  return groups;
}
