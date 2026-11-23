import { describe, expect, it } from "vitest";
import { tallyVotes } from "../src/lib/award-live-types";
import { AWARD_TEMPLATE, parseCeremony, parseEntries } from "../src/lib/award-nominations";
import { hashPassword, verifyPassword } from "../src/lib/password";
describe("award live voting", () => {
  it("preserves ties and excludes abstentions from winner counts", () => {
    expect(tallyVotes(["a", "b", "c"], [{ candidateKey: "a" }, { candidateKey: "b" }, { candidateKey: null }])).toEqual({ counts: { a: 1, b: 1, c: 0 }, voters: 3, abstained: 1, leaders: ["a", "b"] });
    expect(tallyVotes(["a"], [{ candidateKey: null }]).leaders).toEqual([]);
    expect(tallyVotes(["a"], []).leaders).toEqual([]);
    expect(() => tallyVotes(["a"], [{ candidateKey: "outside" }])).toThrow();
  });
  it("allows unfinished drafts while requiring valid final submissions", () => {
    const entries = [{ awardId: AWARD_TEMPLATE[0].id, skipped: false, candidates: [{ title: "", workTitle: "unfinished", reason: "", mediaUrl: "https:/" }] }];
    expect(parseEntries(entries, AWARD_TEMPLATE, true)).toEqual(entries);
    expect(() => parseEntries(entries, AWARD_TEMPLATE)).toThrow();
  });
  it("validates the nomination and membership policies", () => {
    const input = { title: "test", year: 2026, deadline: "2027-01-01", awardIds: [AWARD_TEMPLATE[0].id], nominationMode: "INDEPENDENT", accessMode: "APPROVAL", eligibility: { yearBasis: "AIRED", allowMovies: false } };
    expect(parseCeremony(input, new Date("2026-10-01"))).toMatchObject({ nominationMode: "INDEPENDENT", accessMode: "APPROVAL", eligibility: { yearBasis: "AIRED", allowMovies: false } });
    expect(() => parseCeremony({ ...input, accessMode: "typo" }, new Date("2026-10-01"))).toThrow();
  });
  it("uses individually salted password hashes", async () => {
    const first = await hashPassword("a-personal-password"), second = await hashPassword("a-personal-password");
    expect(first).not.toBe(second);
    expect(await verifyPassword("a-personal-password", first)).toBe(true);
    expect(await verifyPassword("the-shared-invite", first)).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow();
  });
});
