import { describe, expect, it } from "vitest";
import { advanceRehearsal, newRehearsal, type RehearsalAction } from "../src/lib/award-rehearsal";
import { awardPreparationScene, buildHostScript, nextUnrevealedAward } from "../src/lib/award-host-tools";

describe("local award rehearsal", () => {
  function rehearsal(keys = ["a", "b", "c"]) {
    let state = newRehearsal();
    return { get state() { return state; }, act(action: RehearsalAction) { state = advanceRehearsal(state, action, keys); return state; } };
  }
  it("keeps the initial state untouched while running vote, close, confirm and reveal", () => {
    const initial = newRehearsal();
    const next = advanceRehearsal(initial, { type: "open" }, ["a"]);
    expect(initial.rounds).toEqual([]);
    expect(next.rounds).toHaveLength(1);
    const r = rehearsal();
    r.act({ type: "open" });
    r.act({ type: "vote", seat: 0, key: "a" });
    r.act({ type: "vote", seat: 1, key: null });
    r.act({ type: "close" });
    expect(r.state.rounds[0].tally).toMatchObject({ voters: 2, abstained: 1, leaders: ["a"] });
    expect(() => r.act({ type: "reveal" })).toThrow();
    r.act({ type: "decide", method: "VOTE" });
    expect(r.state.scene).toBe("READY");
    r.act({ type: "reveal" });
    expect(r.state.scene).toBe("REVEALED");
    expect(() => r.act({ type: "open" })).toThrow();
    r.act({ type: "reset" });
    expect(r.state).toEqual(newRehearsal());
  });
  it("limits a runoff to tied candidates and preserves previous rounds", () => {
    const r = rehearsal();
    r.act({ type: "open" });
    r.act({ type: "vote", seat: 0, key: "a" });
    r.act({ type: "vote", seat: 1, key: "b" });
    r.act({ type: "close" });
    const first = r.state.rounds[0];
    r.act({ type: "runoff" });
    expect(r.state.rounds[1].keys).toEqual(["a", "b"]);
    expect(() => r.act({ type: "vote", seat: 0, key: "c" })).toThrow();
    r.act({ type: "vote", seat: 0, key: "b" });
    r.act({ type: "close" });
    r.act({ type: "decide", method: "VOTE" });
    expect(r.state.decision?.keys).toEqual(["b"]);
    expect(r.state.rounds[0]).toEqual(first);
  });
  it("never invents winners from abstentions or unsubmitted seats", () => {
    const r = rehearsal();
    r.act({ type: "open" });
    r.act({ type: "vote", seat: 0, key: null });
    r.act({ type: "close" });
    expect(() => r.act({ type: "decide", method: "VOTE" })).toThrow();
    r.act({ type: "open" });
    expect(r.state.rounds[1].votes.every((key) => key === undefined)).toBe(true);
  });
  it("records discussion or withheld results with reasons and no fake votes", () => {
    const r = rehearsal();
    expect(() => r.act({ type: "decide", method: "DISCUSSION", keys: ["a"] })).toThrow();
    r.act({ type: "decide", method: "DISCUSSION", keys: ["a"], reason: "大家讨论的模拟结论" });
    expect(r.state.rounds).toEqual([]);
    r.act({ type: "reset" });
    r.act({ type: "decide", method: "WITHHELD", keys: [], reason: "本项没有合适候选" });
    expect(r.state.decision?.keys).toEqual([]);
    expect(r.state.rounds).toEqual([]);
  });
  it("rejects invalid seats, voting before opening, and changing closed ballots", () => {
    const r = rehearsal();
    expect(() => r.act({ type: "vote", seat: 0, key: "a" })).toThrow();
    r.act({ type: "open" });
    expect(() => r.act({ type: "vote", seat: 3, key: "a" })).toThrow();
    expect(() => r.act({ type: "decide", method: "WITHHELD", reason: "reason" })).toThrow();
    r.act({ type: "close" });
    expect(() => r.act({ type: "vote", seat: 0, key: "a" })).toThrow();
  });
});

describe("host preparation", () => {
  it("derives the prepared award's stage without borrowing another award's live state", () => {
    expect(awardPreparationScene(undefined, undefined)).toBe("NOMINEES");
    expect(awardPreparationScene(undefined, { status: "OPEN" })).toBe("VOTING");
    expect(awardPreparationScene(undefined, { status: "CLOSED" })).toBe("CLOSED");
    expect(awardPreparationScene({ revealedAt: null }, { status: "CLOSED" })).toBe("READY");
    expect(awardPreparationScene({ revealedAt: "now" }, undefined)).toBe("REVEALED");
  });
  it("skips completed awards, wraps to unfinished ones, and stops when finished", () => {
    const awards = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(nextUnrevealedAward(awards, "a", [{ awardId: "b" }])).toBe("c");
    expect(nextUnrevealedAward(awards, "c", [{ awardId: "c" }])).toBe("a");
    expect(nextUnrevealedAward(awards, "c", awards.map((a) => ({ awardId: a.id })))).toBeNull();
    expect(nextUnrevealedAward([], "", [])).toBeNull();
  });
  it("exports ordered nominees and materials without including decisions or tallies", () => {
    const data = { title: "年度晚会", year: 2026, awards: [{ id: "a", title: "动画奖", category: "综合" }, { id: "b", title: "音乐奖", category: "音乐" }],
      published: [{ awardId: "a", candidates: [{ key: "1", title: "候选一", workTitle: "作品一" }] }],
      materials: [{ awardId: "a", title: "候选一", reason: "推荐理由", mediaUrl: "https://example.com/clip" }],
      decisions: [{ winners: [{ title: "secret-winner" }] }], rounds: [{ tally: "secret-tally" }] };
    const text = buildHostScript(data);
    expect(text).toContain("候选一 · 作品一");
    expect(text).toContain("推荐理由");
    expect(text).toContain("https://example.com/clip");
    expect(text.indexOf("1. 动画奖")).toBeLessThan(text.indexOf("2. 音乐奖"));
    expect(text).not.toContain("secret-winner");
    expect(text).not.toContain("secret-tally");
  });
});
