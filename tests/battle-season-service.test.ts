import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("BattleSeason Prisma schema", () => {
  const source = readSource("prisma/schema.prisma");

  it("keeps BattleSeason and BattleVote as season ledger tables", () => {
    expect(source).toContain("enum BattleSeasonMode");
    expect(source).toContain("enum BattleSeasonStatus");
    expect(source).toContain("enum BattleVoteType");
    expect(source).toContain("model BattleSeason");
    expect(source).toContain("model BattleVote");
    expect(source).toContain("@@unique([seasonId, userId, stepNumber])");
  });

  it("adds per-user season Elo scores", () => {
    expect(source).toContain("model BattleSeasonUserScore");
    expect(source).toContain("@@unique([seasonId, userId, animeId])");
    expect(source).toContain("eloScore");
    expect(source).toContain("uncertainty");
    expect(source).toContain("compareCount");
    expect(source).toContain("biasWinCount");
    expect(source).toContain("unseenCount");
    expect(source).toContain("isHidden");
  });

  it("adds Elo audit fields to BattleVote", () => {
    expect(source).toContain("beforeWinnerElo");
    expect(source).toContain("afterWinnerElo");
    expect(source).toContain("beforeLoserElo");
    expect(source).toContain("afterLoserElo");
  });
});

describe("Season service permissions and limits", () => {
  const source = readSource("src/lib/season-service.ts");

  it("keeps editor and manager permission checks", () => {
    expect(source).toContain("canEditPoolContent");
    expect(source).toContain("FORBIDDEN");
    expect(source).toContain("POOL_ARCHIVED");
    expect(source).toContain("SEASON_ALREADY_ACTIVE");
    expect(source).toContain("Ended seasons cannot be edited");
  });

  it("keeps vote limit checks inside the serializable write path", () => {
    expect(source).toContain("MAX_VOTE_WRITE_ATTEMPTS");
    expect(source).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(source).toContain("VOTE_LIMIT_REACHED");
    expect(source).toContain("DAILY_VOTE_LIMIT_REACHED");
    expect(source).toContain("BIAS_VOTES_EXHAUSTED");
    expect(source).toContain("VOTE_WRITE_CONFLICT");
  });

  it("still records one BattleVote per user step", () => {
    expect(source).toContain("const stepNumber = userVotes + 1");
    expect(source).toContain("tx.battleVote.create");
    expect(source).toContain("votesRemaining");
  });
});

describe("Season personal Elo scoring", () => {
  const source = readSource("src/lib/season-service.ts");

  it("initializes per-user season scores from pool anime", () => {
    expect(source).toContain("ensureSeasonUserScores");
    expect(source).toContain("battleSeasonUserScore.createMany");
    expect(source).toContain("SEASON_INITIAL_UNCERTAINTY");
  });

  it("updates only the current user's season Elo on vote", () => {
    expect(source).toContain("updateElo");
    expect(source).toContain("battleSeasonUserScore.update");
    expect(source).toContain("seasonId_userId_animeId");
    expect(source).toContain("biasWinCount: voteType === \"BIAS\"");
  });

  it("keeps bias votes out of personal Elo weighting", () => {
    expect(source).toContain("result: leftWon ? \"LEFT_WIN\" : \"RIGHT_WIN\"");
    expect(source).not.toContain("leftK * weight");
    expect(source).not.toContain("rightK * weight");
  });

  it("stores before and after Elo audit values on BattleVote", () => {
    expect(source).toContain("beforeWinnerElo: winnerBeforeElo");
    expect(source).toContain("afterWinnerElo: winnerAfterElo");
    expect(source).toContain("beforeLoserElo: loserBeforeElo");
    expect(source).toContain("afterLoserElo: loserAfterElo");
  });
});

describe("Season shared aggregation", () => {
  const source = readSource("src/lib/season-service.ts");

  it("aggregates shared ranking from BattleSeasonUserScore", () => {
    expect(source).toContain("aggregateSeasonRanking");
    expect(source).toContain("prisma.battleSeasonUserScore.findMany");
    expect(source).toContain("compareCount: { gt: 0 }");
    expect(source).toContain("isHidden: false");
  });

  it("uses community-style prior and capped user contribution weight", () => {
    expect(source).toContain("SEASON_PRIOR_RATING");
    expect(source).toContain("SEASON_MIN_USERS");
    expect(source).toContain("SEASON_MIN_COMPARISONS");
    expect(source).toContain("Math.min(score.compareCount / 5, 1)");
  });

  it("applies bias buff only during shared aggregation", () => {
    expect(source).toContain("SEASON_BIAS_AGGREGATION_MULTIPLIER");
    expect(source).toContain("score.biasWinCount > 0");
  });

  it("can lazily rebuild old seasons from BattleVote history", () => {
    expect(source).toContain("maybeRebuildSeasonScoresFromVotes");
    expect(source).toContain("rebuildSeasonUserScoresFromVotes");
    expect(source).toContain('orderBy: [{ createdAt: "asc" }, { id: "asc" }]');
  });
});

describe("Season match queue", () => {
  const source = readSource("src/lib/season-service.ts");

  it("reads current user's season scores instead of global vote exposure", () => {
    expect(source).toContain("ensureSeasonUserScores(prisma, poolId, seasonId, userId)");
    expect(source).toContain("scoreMap");
    expect(source).toContain("comparedPairs");
  });

  it("falls back from new pairs to recalibration pairs", () => {
    expect(source).toContain('"NEW_PAIR"');
    expect(source).toContain('"RECALIBRATION"');
    expect(source).toContain("eloDiff");
    expect(source).toContain("nearestSeasonBoundaryDistance");
  });

  it("supports skipped-pair and hidden-anime exclusions", () => {
    expect(source).toContain("excludePairKeys");
    expect(source).toContain("hiddenAnimeIds");
    expect(source).toContain("setSeasonAnimeHidden");
  });
});

describe("Season APIs and client functions", () => {
  it("match queue route forwards exclusion parameters", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/match-queue/route.ts");
    expect(source).toContain("excludePairKeys");
    expect(source).toContain("hiddenAnimeIds");
    expect(source).toContain("limit");
  });

  it("unseen route persists hidden anime", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/unseen/route.ts");
    expect(source).toContain("setSeasonAnimeHidden");
    expect(source).toContain("requireCurrentUser");
  });

  it("client exposes season queue, vote, and hidden anime APIs", () => {
    const source = readSource("src/lib/client-api.ts");
    expect(source).toContain("export function getSeasonMatchQueue");
    expect(source).toContain("export function submitSeasonVote");
    expect(source).toContain("export function setSeasonAnimeHidden");
    expect(source).toContain("minSampleThreshold");
  });
});

describe("Season pages", () => {
  it("detail page exposes shared ranking and shared tierlist views", () => {
    const source = readSource("src/app/pools/[poolId]/seasons/[seasonId]/page.tsx");
    expect(source).toContain("buildSeasonTierBuckets");
    expect(source).toContain("SeasonSharedTierList");
    expect(source).toContain("insufficientSample");
  });

  it("match page sends skipped and hidden state to the backend", () => {
    const source = readSource("src/app/pools/[poolId]/seasons/[seasonId]/match/page.tsx");
    expect(source).toContain("excludePairKeys");
    expect(source).toContain("hiddenAnimeIds");
    expect(source).toContain("setSeasonAnimeHidden");
    expect(source).toContain("handleMarkUnseen");
  });
});

describe("Season migrations", () => {
  const seasonSource = readSource("prisma/migrations/20260618000000_add_battle_seasons/migration.sql");
  const scoreSource = readSource("prisma/migrations/20260623000000_add_battle_season_user_scores/migration.sql");

  it("keeps original battle season tables", () => {
    expect(seasonSource).toContain('CREATE TABLE "BattleSeason"');
    expect(seasonSource).toContain('CREATE TABLE "BattleVote"');
  });

  it("creates user score table and Elo audit fields", () => {
    expect(scoreSource).toContain('CREATE TABLE "BattleSeasonUserScore"');
    expect(scoreSource).toContain('"beforeWinnerElo"');
    expect(scoreSource).toContain('"afterLoserElo"');
    expect(scoreSource).toContain('"BattleSeasonUserScore_seasonId_userId_animeId_key"');
  });
});
