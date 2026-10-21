import { tallyVotes, type Tally } from "./award-live-types";

export type RehearsalRound = {
  keys: string[];
  votes: (string | null | undefined)[];
  tally: Tally | null;
};
export type RehearsalState = {
  scene: "NOMINEES" | "VOTING" | "CLOSED" | "READY" | "REVEALED";
  rounds: RehearsalRound[];
  decision: { method: "VOTE" | "DISCUSSION" | "WITHHELD"; keys: string[]; reason: string } | null;
};
export type RehearsalAction =
  | { type: "open" | "runoff" | "close" | "reveal" | "reset" }
  | { type: "vote"; seat: number; key: string | null | undefined }
  | { type: "decide"; method: "VOTE" | "DISCUSSION" | "WITHHELD"; keys?: string[]; reason?: string };

export const newRehearsal = (): RehearsalState => ({ scene: "NOMINEES", rounds: [], decision: null });

// Pure local state: no session, API, storage, or live ceremony mutations.
export function advanceRehearsal(state: RehearsalState, action: RehearsalAction, candidateKeys: string[]): RehearsalState {
  if (action.type === "reset") return newRehearsal();
  const last = state.rounds.at(-1);
  if (action.type === "open" || action.type === "runoff") {
    if (state.decision || state.scene === "VOTING") throw new Error("请先结束本轮排练，或重置本项");
    const keys = action.type === "runoff" ? last?.tally?.leaders ?? [] : candidateKeys;
    if (action.type === "runoff" && keys.length < 2) throw new Error("只有并列领先才能加赛");
    if (action.type === "open" && last?.tally?.leaders.length) throw new Error("已有模拟结果，可确认或平票加赛");
    if (!keys.length) throw new Error("本项没有入围候选，可练习记录空缺");
    return { ...state, scene: "VOTING", rounds: [...state.rounds, { keys: [...keys], votes: Array(3).fill(undefined), tally: null }] };
  }
  if (action.type === "vote") {
    if (state.scene !== "VOTING" || !last) throw new Error("请先开启模拟投票");
    if (!Number.isInteger(action.seat) || action.seat < 0 || action.seat >= 3) throw new Error("无效的模拟席位");
    if (action.key != null && !last.keys.includes(action.key)) throw new Error("请选择本轮候选");
    const votes = [...last.votes]; votes[action.seat] = action.key;
    return { ...state, rounds: [...state.rounds.slice(0, -1), { ...last, votes }] };
  }
  if (action.type === "close") {
    if (state.scene !== "VOTING" || !last) throw new Error("当前没有模拟投票");
    const tally = tallyVotes(last.keys, last.votes.filter((key) => key !== undefined).map((candidateKey) => ({ candidateKey })));
    return { ...state, scene: "CLOSED", rounds: [...state.rounds.slice(0, -1), { ...last, tally }] };
  }
  if (action.type === "decide") {
    if (state.scene === "VOTING" || state.decision) throw new Error("请先关票；确认后需重置才能修改");
    const keys = action.method === "VOTE" ? last?.tally?.leaders ?? [] : [...new Set(action.keys ?? [])];
    const reason = action.reason?.trim() ?? "";
    if (action.method === "WITHHELD" ? keys.length !== 0 : keys.length === 0) throw new Error("投票或讨论需有获奖者，空缺不选获奖者");
    if (keys.some((key) => !candidateKeys.includes(key))) throw new Error("获奖者需来自入围名单");
    if (action.method !== "VOTE" && !reason) throw new Error("请填写模拟讨论结论或空缺原因");
    return { ...state, scene: "READY", decision: { method: action.method, keys, reason } };
  }
  if (state.scene !== "READY" || !state.decision) throw new Error("请先确认模拟结果");
  return { ...state, scene: "REVEALED" };
}
