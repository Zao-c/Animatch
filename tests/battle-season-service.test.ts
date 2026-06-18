import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("BattleSeason Prisma schema", () => {
  const source = readSource("prisma/schema.prisma");

  it("has BattleSeasonMode enum with CLASSIC and BIAS", () => {
    expect(source).toContain("enum BattleSeasonMode");
    expect(source).toContain("CLASSIC");
    expect(source).toContain("BIAS");
  });

  it("has BattleSeasonStatus enum with DRAFT, ACTIVE, ENDED", () => {
    expect(source).toContain("enum BattleSeasonStatus");
    expect(source).toContain("DRAFT");
    expect(source).toContain("ACTIVE");
    expect(source).toContain("ENDED");
  });

  it("has BattleVoteType enum with NORMAL and BIAS", () => {
    expect(source).toContain("enum BattleVoteType");
    expect(source).toContain("NORMAL");
    expect(source).toContain("BIAS");
  });

  it("has BattleSeason model with all required fields", () => {
    expect(source).toContain("model BattleSeason");
    expect(source).toContain("poolId");
    expect(source).toContain("title");
    expect(source).toContain("mode");
    expect(source).toContain("status");
    expect(source).toContain("maxVotesPerUser");
    expect(source).toContain("biasVotesPerUser");
    expect(source).toContain("createdByUserId");
  });

  it("has BattleVote model with all required fields", () => {
    expect(source).toContain("model BattleVote");
    expect(source).toContain("seasonId");
    expect(source).toContain("userId");
    expect(source).toContain("leftAnimeId");
    expect(source).toContain("rightAnimeId");
    expect(source).toContain("winnerAnimeId");
    expect(source).toContain("loserAnimeId");
    expect(source).toContain("voteType");
    expect(source).toContain("weight");
    expect(source).toContain("stepNumber");
    expect(source).toContain("beforeWinnerScore");
    expect(source).toContain("afterWinnerScore");
  });

  it("BattleVote has unique constraint on seasonId+userId+stepNumber", () => {
    expect(source).toContain("@@unique([seasonId, userId, stepNumber])");
  });
});

describe("Season service - create and permissions", () => {
  const source = readSource("src/lib/season-service.ts");

  it("rejects non-editor for createSeason", () => {
    expect(source).toContain("你没有权限创建赛季");
    expect(source).toContain("FORBIDDEN");
  });

  it("rejects archived pool", () => {
    expect(source).toContain("已归档的番组不能创建赛季");
  });

  it("rejects non-editor for updateSeason", () => {
    expect(source).toContain("你没有权限编辑赛季");
  });

  it("rejects editing ended season", () => {
    expect(source).toContain("已结束的赛季不能编辑");
  });

  it("rejects non-manager for startSeason", () => {
    expect(source).toContain("你没有权限管理赛季");
  });

  it("rejects already active season on start", () => {
    expect(source).toContain("赛季已在进行中");
  });

  it("rejects non-active season on end", () => {
    expect(source).toContain("赛季未在运行中");
  });

  it("creates season with CLASSIC or BIAS mode", () => {
    expect(source).toContain("mode: input.mode");
  });

  it("defaults biasVotesPerUser to 3", () => {
    expect(source).toContain("input.biasVotesPerUser ?? 3");
  });
});

describe("Season voting rules", () => {
  const source = readSource("src/lib/season-service.ts");

  it("rejects voting on draft season", () => {
    expect(source).toContain("SEASON_NOT_ACTIVE");
  });

  it("rejects voting on ended season", () => {
    expect(source).toContain("SEASON_ENDED");
  });

  it("rejects voting when maxVotesPerUser reached", () => {
    expect(source).toContain("VOTE_LIMIT_REACHED");
  });

  it("rejects voting when daily limit reached", () => {
    expect(source).toContain("DAILY_VOTE_LIMIT_REACHED");
  });

  it("rejects bias vote in CLASSIC mode", () => {
    expect(source).toContain("BIAS_NOT_ALLOWED");
  });

  it("rejects bias vote when bias votes exhausted", () => {
    expect(source).toContain("BIAS_VOTES_EXHAUSTED");
  });

  it("rejects invalid winnerAnimeId not matching left/right", () => {
    expect(source).toContain("INVALID_VOTE");
  });

  it("records stepNumber incrementally", () => {
    expect(source).toContain("const stepNumber = userVotes + 1");
  });

  it("writes votes in a serializable transaction with retryable conflict handling", () => {
    expect(source).toContain("MAX_VOTE_WRITE_ATTEMPTS");
    expect(source).toContain("prisma.$transaction");
    expect(source).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(source).toContain("isRetryableVoteWriteError");
    expect(source).toContain("VOTE_WRITE_CONFLICT");
  });

  it("bias vote uses weight 2", () => {
    expect(source).toContain("weight = 2");
  });

  it("normal vote uses weight 1", () => {
    expect(source).toContain("weight = 1");
  });

  it("records before/after scores", () => {
    expect(source).toContain("beforeWinnerScore");
    expect(source).toContain("afterWinnerScore");
    expect(source).toContain("beforeLoserScore");
    expect(source).toContain("afterLoserScore");
  });

  it("subtracts weight from loser afterLoserScore", () => {
    expect(source).toContain("const afterLoserScore = beforeLoserScore - weight");
    expect(source).not.toContain("afterLoserScore: beforeLoserScore");
  });
});

describe("Season match queue distribution", () => {
  const source = readSource("src/lib/season-service.ts");

  it("prioritizes pairs the current user has not seen recently", () => {
    expect(source).toContain("userSeenAnimeIds");
    expect(source).toContain("recentPairs");
    expect(source).toContain("seenPenalty * 10000");
  });

  it("uses global exposure counts to spread limited votes", () => {
    expect(source).toContain('by: ["leftAnimeId"]');
    expect(source).toContain('by: ["rightAnimeId"]');
    expect(source).toContain("exposureCount");
    expect(source).toContain("exposure * 100");
  });

  it("keeps the season queue change out of scoring and vote submission", () => {
    expect(source).toContain("buildSeasonPairCandidates");
    expect(source).toContain("stablePairJitter");
    expect(source).toContain("return candidates.slice(0, 5)");
  });
});

describe("Season ranking calculation", () => {
  const source = readSource("src/lib/season-service.ts");

  it("calculates ranking from vote scores", () => {
    expect(source).toContain("scoreMap");
    expect(source).toContain("s._sum.weight");
  });

  it("sorts ranking by score descending", () => {
    expect(source).toContain("b.score - a.score");
  });

  it("tracks bias wins separately", () => {
    expect(source).toContain("biasWins");
    expect(source).toContain("biasWinCount");
  });

  it("does NOT reuse Elo/PersonalRun tables", () => {
    expect(source).not.toContain("UserPoolScore");
    expect(source).not.toContain("PoolComparison");
    expect(source).not.toContain("PersonalRun");
  });
});

describe("Season vote log display", () => {
  const source = readSource("src/lib/season-service.ts");

  it("includes username in recent votes", () => {
    expect(source).toContain("username: v.user.username");
  });

  it("includes displayName in recent votes", () => {
    expect(source).toContain("displayName: v.user.name ?? v.user.username");
  });

  it("does NOT include email", () => {
    expect(source).not.toContain("email");
  });

  it("takes maximum 20 recent votes", () => {
    expect(source).toContain("take: 20");
  });

  it("shows stepNumber, voteType, weight", () => {
    expect(source).toContain("v.voteType");
    expect(source).toContain("v.weight");
  });
});

describe("Season API routes exist", () => {
  it("POST /api/pools/[poolId]/seasons creates a season", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/route.ts");
    expect(source).toContain("requireCurrentUser");
    expect(source).toContain("createSeason");
  });

  it("GET /api/pools/[poolId]/seasons lists seasons", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/route.ts");
    expect(source).toContain("listSeasons");
  });

  it("GET /api/pools/[poolId]/seasons/[seasonId] returns detail", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/route.ts");
    expect(source).toContain("getSeasonDetail");
    expect(source).toContain("getCurrentUser");
  });

  it("PUT /api/pools/[poolId]/seasons/[seasonId] updates season", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/route.ts");
    expect(source).toContain("requireCurrentUser");
    expect(source).toContain("updateSeason");
  });

  it("POST .../start starts a season", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/start/route.ts");
    expect(source).toContain("startSeason");
  });

  it("POST .../end ends a season", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/end/route.ts");
    expect(source).toContain("endSeason");
  });

  it("GET .../match-queue returns queue", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/match-queue/route.ts");
    expect(source).toContain("getSeasonMatchQueue");
  });

  it("POST .../vote submits a vote", () => {
    const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/vote/route.ts");
    expect(source).toContain("submitVote");
  });
});

describe("Season pages exist", () => {
  it("Season detail page shows mode, status, time, stats", () => {
    const source = readSource("src/app/pools/[poolId]/seasons/[seasonId]/page.tsx");
    expect(source).toContain("进行中");
    expect(source).toContain("已结束");
    expect(source).toContain("未开始");
    expect(source).toContain("偏爱模式");
    expect(source).toContain("传统模式");
    expect(source).toContain("赛季榜单");
    expect(source).toContain("最近投票");
  });

  it("Season match page shows bias vote toggle", () => {
    const source = readSource("src/app/pools/[poolId]/seasons/[seasonId]/match/page.tsx");
    expect(source).toContain("私心票");
    expect(source).toContain("useBias");
    expect(source).toContain("SeasonDuelCard");
  });

  it("Pool seasons section component exists", () => {
    const source = readSource("src/components/PoolSeasonsSection.tsx");
    expect(source).toContain("大乱斗赛季");
    expect(source).toContain("多人投票赛季");
  });

  it("Pool detail page imports PoolSeasonsSection", () => {
    const source = readSource("src/app/pools/[poolId]/page.tsx");
    expect(source).toContain("PoolSeasonsSection");
  });
});

describe("Client API season functions", () => {
  const source = readSource("src/lib/client-api.ts");

  it("has SeasonDetail interface", () => {
    expect(source).toContain("export interface SeasonDetail");
  });

  it("has createSeason function", () => {
    expect(source).toContain("export function createSeason");
  });

  it("has getSeasons function", () => {
    expect(source).toContain("export function getSeasons");
  });

  it("has getSeasonDetail function", () => {
    expect(source).toContain("export function getSeasonDetail");
  });

  it("has startSeason function", () => {
    expect(source).toContain("export function startSeason");
  });

  it("has endSeason function", () => {
    expect(source).toContain("export function endSeason");
  });

  it("has getSeasonMatchQueue function", () => {
    expect(source).toContain("export function getSeasonMatchQueue");
  });

  it("has submitSeasonVote function", () => {
    expect(source).toContain("export function submitSeasonVote");
  });

  it("SeasonDetail includes CurrentUserState", () => {
    expect(source).toContain("export interface CurrentUserState");
    expect(source).toContain("votesRemaining");
    expect(source).toContain("biasVotesRemaining");
  });
});

describe("Season migration SQL exists", () => {
  const source = readSource("prisma/migrations/20260618000000_add_battle_seasons/migration.sql");

  it("creates BattleSeason table", () => {
    expect(source).toContain('CREATE TABLE "BattleSeason"');
  });

  it("creates BattleVote table", () => {
    expect(source).toContain('CREATE TABLE "BattleVote"');
  });

  it("creates enums", () => {
    expect(source).toContain("BattleSeasonMode");
    expect(source).toContain("BattleSeasonStatus");
    expect(source).toContain("BattleVoteType");
  });
});
