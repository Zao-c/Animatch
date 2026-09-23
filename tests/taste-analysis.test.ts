import { describe, expect, it } from "vitest";
import { buildTasteProfile, compareStages, compareTaste, type TasteEntry } from "../src/lib/taste-analysis";
import { nicheRanking, rankingEvidence } from "../src/lib/ranking-evidence";

function entries(count: number, reverse = false): TasteEntry[] {
  return Array.from({ length: count }, (_, i) => ({ animeId: `a${i}`, title: `作品${i}`, imageUrl: null, tags: [i % 2 ? "恋爱" : "悬疑"], score: reverse ? i : count - i }));
}

describe("taste similarity", () => {
  it("compares only the 20 shared works when A has 50 and B has 30", () => {
    const a = entries(50);
    const b = [...entries(20), ...entries(10).map((item) => ({ ...item, animeId: `other${item.animeId}` }))];
    const result = compareTaste(a, b);
    expect(result).toMatchObject({ commonCount: 20, leftCount: 50, rightCount: 30, similarity: 100, eligible: true });
  });
  it("detects opposite rankings without treating unseen items as dislikes", () => {
    expect(compareTaste(entries(20), entries(20, true))).toMatchObject({ similarity: 0, eligible: true });
  });
  it("handles tied tiers symmetrically and excludes all ties from extremes", () => {
    const ties = entries(10).map((item, i) => ({ ...item, score: Math.floor(i / 2) }));
    expect(compareTaste(ties, ties).similarity).toBe(100);
    expect(compareTaste(ties, entries(10))).toEqual(expect.objectContaining({ similarity: compareTaste(entries(10), ties).similarity }));
    expect(compareTaste(ties.map((item) => ({ ...item, score: 1500 })), ties)).toMatchObject({ similarity: null, eligible: false });
  });
  it("requires enough common works and shrinks extremes for weaker evidence", () => {
    expect(compareTaste(entries(3), entries(3))).toMatchObject({ similarity: 100, eligible: false });
    expect(compareTaste(entries(30), entries(30)).adjustedSimilarity).toBeGreaterThan(compareTaste(entries(10), entries(10)).adjustedSimilarity!);
    expect(compareTaste([], entries(10))).toMatchObject({ similarity: null, commonCount: 0 });
  });
  it("does not count repeated records as additional people or works", () => {
    expect(compareTaste([...entries(10), ...entries(10)], entries(10)).commonCount).toBe(10);
  });
});

describe("profile and stage comparisons", () => {
  it("deduplicates works across repeated seasons and preserves exposure counts", () => {
    expect(buildTasteProfile([entries(10), entries(10)]).animeCount).toBe(10);
    expect(buildTasteProfile([entries(10), entries(10)]).tags.every((tag) => tag.count === 5)).toBe(true);
  });
  it("does not infer genre preference when the entire pool has the same genre", () => {
    expect(buildTasteProfile([entries(10).map((item) => ({ ...item, tags: ["恋爱"] }))]).tags[0].preference).toBeNull();
  });
  it("reranks common titles instead of subtracting raw Elo or full-pool ranks", () => {
    const before = entries(3);
    const after = [{ ...before[0], score: 100 }, { ...before[2], score: 200 }];
    expect(compareStages(before, after)).toEqual([
      expect.objectContaining({ animeId: "a2", beforeRank: 2, afterRank: 1, change: 1 }),
      expect.objectContaining({ animeId: "a0", beforeRank: 1, afterRank: 2, change: -1 })
    ]);
  });
});

describe("community evidence", () => {
  it("reports independent samples and dispersion without giving popular works a score bonus", () => {
    expect(rankingEvidence([1500, 1600, 1700], 6)).toEqual({ coverage: 50, ratingDeviation: 82, sampleLabel: "小样本" });
    expect(rankingEvidence([], 0)).toEqual({ coverage: 0, ratingDeviation: null, sampleLabel: "暂无评价" });
  });
  it("preserves small, well-liked works without promoting one-voter samples", () => {
    const rows = [{ animeId: "a", participantCount: 5, averageRating: 1800 }, { animeId: "b", participantCount: 30, averageRating: 1700 }, { animeId: "c", participantCount: 1, averageRating: 2000 }];
    expect(nicheRanking(rows).map((row) => row.animeId)).toEqual(["a"]);
  });
});
