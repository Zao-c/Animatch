import type { SuggestedNominee } from "./award-nominations";

export type PublishedAward = { awardId: string; candidates: SuggestedNominee[] };
export type CandidateMerge = { awardId: string; from: string; to: string; at: string };
export type Tally = { counts: Record<string, number>; voters: number; abstained: number; leaders: string[] };
export function tallyVotes(keys: string[], votes: { candidateKey: string | null }[]): Tally {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  let abstained = 0;
  for (const vote of votes) {
    if (vote.candidateKey === null) abstained++;
    else if (Object.hasOwn(counts, vote.candidateKey)) counts[vote.candidateKey]++;
    else throw new Error("选票包含轮次之外的候选");
  }
  const max = Math.max(0, ...Object.values(counts));
  return { counts, voters: votes.length, abstained, leaders: max > 0 ? keys.filter((key) => counts[key] === max) : [] };
}
