export function rankingEvidence(ratings: number[], totalParticipants: number) {
  const count = ratings.length;
  const average = count ? ratings.reduce((sum, score) => sum + score, 0) / count : 0;
  return {
    coverage: totalParticipants > 0 ? Math.round(count / totalParticipants * 100) : 0,
    ratingDeviation: count >= 3 ? Math.round(Math.sqrt(ratings.reduce((sum, score) => sum + (score - average) ** 2, 0) / count)) : null,
    sampleLabel: count === 0 ? "暂无评价" : count < 10 ? "小样本" : "已有多位用户评价"
  };
}

export function nicheRanking<T extends { participantCount: number; comparisonCount?: number; averageRating?: number | null; averageElo?: number | null; animeId: string }>(items: T[]) {
  return items.filter((item) => item.participantCount >= 3 && item.participantCount < 10 &&
    (item.comparisonCount === undefined || item.comparisonCount >= 6) &&
    (item.averageRating ?? item.averageElo ?? 0) > 1500)
    .sort((a, b) => (b.averageRating ?? b.averageElo ?? 0) - (a.averageRating ?? a.averageElo ?? 0) || a.animeId.localeCompare(b.animeId));
}
