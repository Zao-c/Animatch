import { ANIME_TAG_DICTIONARY, matchTagAliases } from "./anime-tag-dictionary";
import { isGeneratedOrNoisyTitle } from "./anime-display";

export interface TasteEntry {
  animeId: string;
  title: string;
  imageUrl: string | null;
  tags: string[];
  score: number;
}

// Midranks preserve ties; scores from different pools are never directly averaged.
export function relativeRanks(items: TasteEntry[]): Map<string, number> {
  const sorted = [...new Map(items.map((item) => [item.animeId, item])).values()]
    .filter((item) => Number.isFinite(item.score)).sort((a, b) => b.score - a.score);
  const result = new Map<string, number>();
  for (let i = 0; i < sorted.length;) {
    let end = i + 1;
    while (end < sorted.length && sorted[end].score === sorted[i].score) end++;
    for (let j = i; j < end; j++) result.set(sorted[j].animeId, (i + end - 1) / 2 + 1);
    i = end;
  }
  return result;
}

export function compareTaste(a: TasteEntry[], b: TasteEntry[]) {
  const left = new Map(a.map((item) => [item.animeId, item]));
  const right = new Map(b.map((item) => [item.animeId, item]));
  const common = [...left.keys()].filter((id) => right.has(id));
  const aRanks = relativeRanks(common.map((id) => left.get(id)!));
  const bRanks = relativeRanks(common.map((id) => right.get(id)!));
  let concordant = 0, discordant = 0, tiesA = 0, tiesB = 0;
  for (let i = 0; i < common.length; i++) {
    for (let j = i + 1; j < common.length; j++) {
      const x = Math.sign(aRanks.get(common[i])! - aRanks.get(common[j])!);
      const y = Math.sign(bRanks.get(common[i])! - bRanks.get(common[j])!);
      if (x === 0 && y === 0) continue;
      if (x === 0) tiesA++;
      else if (y === 0) tiesB++;
      else if (x === y) concordant++;
      else discordant++;
    }
  }
  const denominator = Math.sqrt((concordant + discordant + tiesA) * (concordant + discordant + tiesB));
  const tau = denominator === 0 ? null : (concordant - discordant) / denominator;
  const evidenceWeight = common.length / (common.length + 10);
  const differences = common.map((id) => ({
    animeId: id, title: left.get(id)!.title,
    leftRank: aRanks.get(id)!, rightRank: bRanks.get(id)!,
    difference: Math.abs(aRanks.get(id)! - bRanks.get(id)!)
  }));
  return {
    commonCount: common.length, leftCount: left.size, rightCount: right.size,
    similarity: tau === null ? null : Math.round((tau + 1) * 50),
    adjustedSimilarity: tau === null ? null : 50 + tau * evidenceWeight * 50,
    eligible: common.length >= 5 && tau !== null,
    agreements: differences.filter((item) => item.leftRank <= common.length / 3 && item.rightRank <= common.length / 3)
      .sort((a, b) => a.leftRank + a.rightRank - b.leftRank - b.rightRank).slice(0, 3),
    disagreements: differences.filter((item) => item.difference > 0).sort((a, b) => b.difference - a.difference).slice(0, 3)
  };
}

export function buildTasteProfile(scopes: TasteEntry[][]) {
  const works = new Map<string, { item: TasteEntry; sum: number; count: number }>();
  for (const entries of scopes) {
    const ranks = relativeRanks(entries);
    if (ranks.size < 2) continue;
    for (const item of new Map(entries.map((entry) => [entry.animeId, entry])).values()) {
      const rank = ranks.get(item.animeId);
      if (rank === undefined) continue;
      const preference = 1 - (rank - 1) / (ranks.size - 1);
      const value = works.get(item.animeId) ?? { item, sum: 0, count: 0 };
      value.sum += preference; value.count++;
      works.set(item.animeId, value);
    }
  }
  const tagLabels = new Map(ANIME_TAG_DICTIONARY
    .filter((entry) => ["类型", "场景", "氛围", "题材"].includes(entry.group))
    .map((entry) => [entry.key, entry.label]));
  const tags = new Map<string, { count: number; sum: number; examples: string[] }>();
  for (const { item, sum, count } of works.values()) {
    const meaningfulTags = new Set(item.tags
      .map((tag) => tagLabels.get(matchTagAliases(tag) ?? ""))
      .filter((tag): tag is string => Boolean(tag)));
    for (const tag of meaningfulTags) {
      const value = tags.get(tag) ?? { count: 0, sum: 0, examples: [] };
      value.count++; value.sum += sum / count;
      if (value.examples.length < 3) value.examples.push(item.title);
      tags.set(tag, value);
    }
  }
  return {
    animeCount: works.size, scopeCount: scopes.filter((scope) => scope.length >= 2).length,
    favorites: [...works.values()]
      .map(({ item, sum, count }) => ({ animeId: item.animeId, title: item.title, imageUrl: item.imageUrl,
        scopeCount: count, preference: sum / count }))
      .filter((item) => item.preference >= 0.65 && !isGeneratedOrNoisyTitle(item.title))
      .sort((a, b) => b.preference - a.preference || b.scopeCount - a.scopeCount || a.title.localeCompare(b.title))
      .slice(0, 4).map(({ preference: _preference, ...item }) => item),
    tags: [...tags].filter(([, value]) => value.count >= 2).map(([tag, value]) => ({ tag, count: value.count,
      preference: value.count >= 3 && value.count < works.size ? Math.round(value.sum / value.count * 100) : null,
      examples: value.examples
    })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 6)
  };
}

export function compareStages(before: TasteEntry[], after: TasteEntry[]) {
  const ids = new Set(after.map((item) => item.animeId));
  const commonBefore = before.filter((item) => ids.has(item.animeId));
  const beforeIds = new Set(commonBefore.map((item) => item.animeId));
  const commonAfter = after.filter((item) => beforeIds.has(item.animeId));
  const first = relativeRanks(commonBefore), last = relativeRanks(commonAfter);
  return commonBefore.map((item) => ({ ...item, beforeRank: first.get(item.animeId)!,
    afterRank: last.get(item.animeId)!, change: first.get(item.animeId)! - last.get(item.animeId)!
  })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.afterRank - b.afterRank);
}
