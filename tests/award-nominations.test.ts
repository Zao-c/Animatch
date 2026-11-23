import { describe, expect, it } from "vitest";
import { AWARD_TEMPLATE, ballotProgress, csvCell, nominationSuggestions, nomineeKey, parseCeremony, parseEntries, parseShortlist, summarizeNominations } from "../src/lib/award-nominations";
const awards = AWARD_TEMPLATE.slice(0, 2);
const candidate = { title: "作品 A", workTitle: "", reason: "喜欢", mediaUrl: "https://example.com/watch" };
const entry = { awardId: awards[0].id, skipped: false, candidates: [candidate] };
describe("nomination validation and counting", () => {
  it("requires a future deadline and a nonempty valid award selection", () => {
    const valid = { title: "年度动画大赏", year: 2026, deadline: "2027-01-01T00:00:00Z", awardIds: [awards[0].id] };
    expect(parseCeremony(valid, new Date("2026-10-01")).awards).toEqual([awards[0]]);
    expect(() => parseCeremony(valid, new Date("2027-02-01"))).toThrow("未来");
    expect(() => parseCeremony({ ...valid, awardIds: ["unknown"] }, new Date("2026-10-01"))).toThrow();
  });
  it("rejects duplicate candidates and awards, excess candidates, and contradictory skips", () => {
    expect(() => parseEntries([entry, entry], awards)).toThrow();
    expect(() => parseEntries([{ ...entry, candidates: [candidate, { ...candidate, title: "作品 Ａ" }] }], awards)).toThrow("重复");
    expect(() => parseEntries([{ ...entry, candidates: Array(4).fill(candidate) }], awards)).toThrow();
    expect(() => parseEntries([{ ...entry, skipped: true }], awards)).toThrow();
  });
  it("keeps same-name characters from different works separate and rejects active links", () => {
    expect(nomineeKey(candidate)).not.toEqual(nomineeKey({ ...candidate, workTitle: "另一部作品" }));
    expect(() => parseEntries([{ ...entry, candidates: [{ ...candidate, mediaUrl: "javascript:alert(1)" }] }], awards)).toThrow();
    expect(() => parseEntries([{ ...entry, candidates: [{ ...candidate, mediaUrl: "https://user:pass@example.com" }] }], awards)).toThrow();
  });
  it("counts people once per candidate and keeps skips distinct from missing responses", () => {
    const summaries = summarizeNominations(awards, [
      { name: "甲", entries: [{ ...entry, candidates: [candidate, candidate] }] },
      { name: "乙", entries: [{ ...entry, candidates: [{ ...candidate, title: "作品 Ａ" }] }] },
      { name: "丙", entries: [{ ...entry, skipped: true, candidates: [] }] }, { name: "丁", entries: [] }
    ]);
    expect(summaries[0]).toMatchObject({ participantCount: 2, skippedCount: 1, candidates: [{ count: 2 }] });
    expect(summaries[1].participantCount).toBe(0);
    expect(ballotProgress([entry], awards)).toEqual({ nominated: 1, skipped: 0, remaining: 1 });
    expect(() => parseShortlist({ [awards[0].id]: ["invented"] }, summaries)).toThrow();
    expect(parseShortlist({ [awards[0].id]: [nomineeKey(candidate)] }, summaries)[awards[0].id]).toHaveLength(1);
  });
  it("escapes CSV quotes and neutralizes spreadsheet formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(' =HYPERLINK("url")')).toMatch(/^"'/);
    expect(csvCell("普通文字")).toBe('"普通文字"');
  });
  it("groups translated titles by the same reference and counts one supporter per ballot", () => {
    const linked = { ...candidate, reference: { kind: "subject" as const, id: 123 } };
    const translated = { ...linked, title: "別の訳名", workTitle: "副标题" };
    expect(nomineeKey(linked)).toBe(nomineeKey(translated));
    expect(() => parseEntries([{ ...entry, candidates: [linked, translated] }], awards)).toThrow("重复");
    const summary = summarizeNominations(awards, [{ name: "甲", entries: [{ ...entry, candidates: [linked, translated] }] }, { name: "乙", entries: [{ ...entry, candidates: [translated] }] }]);
    expect(summary[0].candidates).toHaveLength(1);
    expect(summary[0].candidates[0].count).toBe(2);
    const suggestions = nominationSuggestions(summary);
    expect(suggestions[0].candidates[0]).toEqual({ key: "bgm:subject:123", title: linked.title, workTitle: "", reference: linked.reference });
    expect(JSON.stringify(suggestions)).not.toContain("supporters");
    expect(JSON.stringify(suggestions)).not.toContain("count");
    expect(JSON.stringify(suggestions)).not.toContain("喜欢");
  });
  it("does not equate a person and a character with the same ID, or link an episode to an entire show", () => {
    expect(nomineeKey({ ...candidate, reference: { kind: "person", id: 123 } })).not.toBe(nomineeKey({ ...candidate, reference: { kind: "character", id: 123 } }));
    expect(() => parseEntries([{ awardId: awards[1].id, skipped: false, candidates: [{ ...candidate, reference: { kind: "subject", id: 123 } }] }], awards)).toThrow();
    expect(() => parseEntries([{ ...entry, candidates: [{ ...candidate, reference: { kind: "person", id: 123 } }] }], awards)).toThrow();
    expect(() => parseEntries([{ ...entry, candidates: [{ ...candidate, reference: { kind: "subject", id: -1 } }] }], awards)).toThrow();
  });
});
