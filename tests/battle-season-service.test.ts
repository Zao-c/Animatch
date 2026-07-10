import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SEASON_DAILY_LIMIT_TIME_ZONE,
  getSeasonDailyVoteWindow,
  normalizeSeasonCreateInput,
  normalizeSeasonUpdateInput
} from "../src/lib/season-service";

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
    expect(source).toContain("clientMutationId");
    expect(source).toContain("@@unique([seasonId, userId, clientMutationId])");
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
    expect(source).toContain("canReadPool");
    expect(source).toContain("canPlayPool");
    expect(source).toContain("getReadableSeasonPool");
    expect(source).toContain("getPlayableSeasonPool");
    expect(source).toContain("FORBIDDEN");
    expect(source).toContain("POOL_ARCHIVED");
    expect(source).toContain("SEASON_ALREADY_ACTIVE");
    expect(source).toContain("Ended seasons cannot be edited");
  });

  it("keeps vote limit checks inside the serializable write path", () => {
    expect(source).toContain("MAX_VOTE_WRITE_ATTEMPTS");
    expect(source).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(source).toContain("findExistingBattleVoteResult");
    expect(source).toContain("toVoteResult(existingVote, season.maxVotesPerUser)");
    expect(source).toContain("isClientMutationConflict");
    expect(source).toContain("VOTE_LIMIT_REACHED");
    expect(source).toContain("DAILY_VOTE_LIMIT_REACHED");
    expect(source).toContain("BIAS_VOTES_EXHAUSTED");
    expect(source).toContain("VOTE_WRITE_CONFLICT");
  });

  it("uses one Asia/Shanghai day window for daily vote display and write guard", () => {
    expect(SEASON_DAILY_LIMIT_TIME_ZONE).toBe("Asia/Shanghai");

    const beforeShanghaiMidnight = getSeasonDailyVoteWindow(
      new Date("2026-07-10T15:59:59.000Z")
    );
    expect(beforeShanghaiMidnight.start.toISOString()).toBe("2026-07-09T16:00:00.000Z");
    expect(beforeShanghaiMidnight.end.toISOString()).toBe("2026-07-10T16:00:00.000Z");

    const afterShanghaiMidnight = getSeasonDailyVoteWindow(
      new Date("2026-07-10T16:00:00.000Z")
    );
    expect(afterShanghaiMidnight.start.toISOString()).toBe("2026-07-10T16:00:00.000Z");
    expect(afterShanghaiMidnight.end.toISOString()).toBe("2026-07-11T16:00:00.000Z");

    expect(source).toContain("getSeasonDailyVoteWindow");
    expect(source).toContain("createdAt: { gte: dailyWindow.start, lt: dailyWindow.end }");
    expect(source).not.toContain("setHours(0, 0, 0, 0)");
  });

  it("still records one BattleVote per user step", () => {
    expect(source).toContain("const stepNumber = userVotes + 1");
    expect(source).toContain("tx.battleVote.create");
    expect(source).toContain("clientMutationId: input.clientMutationId ?? null");
    expect(source).toContain("votesRemaining");
  });

  it("validates create input before writing broken season rows", () => {
    expect(() =>
      normalizeSeasonCreateInput({
        title: "   ",
        mode: "BIAS"
      })
    ).toThrow("Season title is required");
    expect(() =>
      normalizeSeasonCreateInput({
        title: "四月完结",
        mode: "BIAS",
        maxVotesPerUser: 0
      })
    ).toThrow("maxVotesPerUser must be at least 1");
    expect(() =>
      normalizeSeasonCreateInput({
        title: "四月完结",
        mode: "BIAS",
        maxVotesPerUserPerDay: -1
      })
    ).toThrow("maxVotesPerUserPerDay must be at least 1");
    expect(() =>
      normalizeSeasonCreateInput({
        title: "四月完结",
        mode: "BIAS",
        biasVotesPerUser: -1
      })
    ).toThrow("biasVotesPerUser cannot be negative");
  });

  it("normalizes valid create and update input", () => {
    const startsAt = new Date("2026-07-01T00:00:00.000Z");
    const endsAt = new Date("2026-07-31T00:00:00.000Z");

    expect(
      normalizeSeasonCreateInput({
        title: "  四月完结  ",
        description: "  多人赛季  ",
        mode: "BIAS",
        startsAt,
        endsAt,
        maxVotesPerUser: 100,
        maxVotesPerUserPerDay: 20,
        biasVotesPerUser: 0
      })
    ).toMatchObject({
      title: "四月完结",
      description: "多人赛季",
      startsAt,
      endsAt,
      maxVotesPerUser: 100,
      maxVotesPerUserPerDay: 20,
      biasVotesPerUser: 0
    });

    expect(
      normalizeSeasonUpdateInput({
        title: "  七月新番  ",
        description: "   ",
        maxVotesPerUserPerDay: null
      })
    ).toEqual({
      title: "七月新番",
      description: null,
      maxVotesPerUserPerDay: null
    });
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

  it("keeps zero-vote pool anime visible as insufficient shared ranking items", () => {
    expect(source).toContain("participantCount === 0");
    expect(source).toContain("? SEASON_PRIOR_RATING");
    expect(source).not.toContain(".filter((item) => item.participantCount > 0)");
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
    expect(source).toContain("ANIME_HIDDEN");
    expect(source).toContain("Hidden anime cannot be voted");
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
    expect(source).toContain("clientMutationId?: string");
    expect(source).toContain("minSampleThreshold");
    expect(source).toContain("hiddenAnimeIds: string[]");
    expect(source).toContain("tierRows: TierRowConfig[]");
    expect(source).toContain("currentUserRanking: SeasonPersonalRankingItem[]");
  });
});

describe("Season pages", () => {
  it("detail page exposes shared ranking and shared tierlist views", () => {
    const source = readSource("src/app/pools/[poolId]/seasons/[seasonId]/page.tsx");
    expect(source).toContain("buildSeasonTierBuckets");
    expect(source).toContain("detail?.tierRows ?? DEFAULT_TIER_CONFIG.rows");
    expect(source).toContain("SeasonSharedTierList");
    expect(source).toContain("insufficientSample");
  });

  it("detail page exposes the current user's personal season result separately", () => {
    const source = readSource("src/app/pools/[poolId]/seasons/[seasonId]/page.tsx");
    expect(source).toContain("SeasonPersonalResult");
    expect(source).toContain("我的赛季 Tier List");
    expect(source).toContain("currentUserRanking");
    expect(source).toContain("buildPersonalSeasonTierBuckets");
    expect(source).toContain("私心票不会放大这里的 Elo");
  });

  it("match page sends skipped and hidden state to the backend", () => {
    const source = readSource("src/app/pools/[poolId]/seasons/[seasonId]/match/page.tsx");
    expect(source).toContain("excludePairKeys");
    expect(source).toContain("hiddenAnimeIds");
    expect(source).toContain("setSeasonAnimeHidden");
    expect(source).toContain("handleMarkUnseen");
    expect(source).toContain("createVoteMutationId");
    expect(source).toContain("clientMutationId");
    expect(source).toContain("serverHiddenAnimeIds");
    expect(source).toContain("nextSkippedPairKeys.add(seasonMatchPairKey(currentPair))");
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

  it("adds season vote idempotency migration", () => {
    const idempotencySource = readSource("prisma/migrations/20260624000000_add_battle_vote_client_mutation_id/migration.sql");
    expect(idempotencySource).toContain('ADD COLUMN "clientMutationId" TEXT');
    expect(idempotencySource).toContain('"BattleVote_seasonId_userId_clientMutationId_key"');
  });
});
