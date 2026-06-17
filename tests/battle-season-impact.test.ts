import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("BattleSeasonImpact service", () => {
  const source = readSource("src/lib/server/battle-season-impact.ts");

  it("has getBattleSeasonImpact function", () => {
    expect(source).toContain("export async function getBattleSeasonImpact");
  });

  it("has UserImpactEntry interface", () => {
    expect(source).toContain("export interface UserImpactEntry");
    expect(source).toContain("userId: string");
    expect(source).toContain("totalScoreSwing: number");
    expect(source).toContain("supportedAnimeTop3");
    expect(source).toContain("suppressedAnimeTop3");
  });

  it("has AnimeSupportEntry interface", () => {
    expect(source).toContain("export interface AnimeSupportEntry");
    expect(source).toContain("supportScore: number");
    expect(source).toContain("topSupporters");
  });

  it("has AnimeSuppressionEntry interface", () => {
    expect(source).toContain("export interface AnimeSuppressionEntry");
    expect(source).toContain("suppressionScore: number");
    expect(source).toContain("topSuppressors");
  });

  it("has KeyVoteEntry interface", () => {
    expect(source).toContain("export interface KeyVoteEntry");
    expect(source).toContain("totalSwing: number");
    expect(source).toContain("winnerScoreDelta");
    expect(source).toContain("loserScoreDelta");
  });

  it("has BiasVoteStats interface", () => {
    expect(source).toContain("export interface BiasVoteStats");
    expect(source).toContain("topBiasUsers");
    expect(source).toContain("topBiasSupportedAnime");
  });

  it("has BattleSeasonImpact interface", () => {
    expect(source).toContain("export interface BattleSeasonImpact");
    expect(source).toContain("userImpactRanking");
    expect(source).toContain("animeSupportRanking");
    expect(source).toContain("animeSuppressionRanking");
    expect(source).toContain("keyVotes");
    expect(source).toContain("biasVoteStats");
    expect(source).toContain("currentUserImpact");
  });

  it("computes swing from before/after scores", () => {
    expect(source).toContain("computeSwing");
    expect(source).toContain("afterWinnerScore - v.beforeWinnerScore");
    expect(source).toContain("afterLoserScore - v.beforeLoserScore");
  });

  it("falls back to weight * 2 when scores are zero", () => {
    expect(source).toContain("v.weight * 2");
  });

  it("queries BattleVote with user include", () => {
    expect(source).toContain("prisma.battleVote.findMany");
    expect(source).toContain("user: { select: { id: true, username: true, name: true, image: true } }");
  });

  it("queries anime in batch (not N+1)", () => {
    expect(source).toContain("prisma.anime.findMany");
    expect(source).toContain("id: { in: allAnimeIds }");
    expect(source).toContain("animeMap = new Map");
  });

  it("tracks user stats (voteCount / weight / swing)", () => {
    expect(source).toContain("ue.voteCount++");
    expect(source).toContain("ue.totalWeight += v.weight");
    expect(source).toContain("ue.totalScoreSwing += swing");
  });

  it("tracks normal vote count separately from bias", () => {
    expect(source).toContain("ue.normalVoteCount++");
    expect(source).toContain("ue.biasVoteCount++");
  });

  it("tracks bias votes in biasUserMap", () => {
    expect(source).toContain("biasUserMap.set");
    expect(source).toContain("biasWinnerCount.set");
    expect(source).toContain("totalBiasVotes++");
  });

  it("correctly maps winner to support and loser to suppression", () => {
    expect(source).toContain("animeSupportMap.get(v.winnerAnimeId)");
    expect(source).toContain("animeSuppressionMap.get(v.loserAnimeId)");
  });

  it("ranks users by totalScoreSwing desc", () => {
    expect(source).toContain("b.totalScoreSwing - a.totalScoreSwing");
  });

  it("ranks anime support by supportScore desc", () => {
    expect(source).toContain("b.supportScore - a.supportScore");
  });

  it("ranks anime suppression by suppressionScore desc", () => {
    expect(source).toContain("b.suppressionScore - a.suppressionScore");
  });

  it("builds supportedAnimeTop3 per user", () => {
    expect(source).toContain("supportedAnimeTop3");
    expect(source).toContain(".slice(0, 3)");
    expect(source).toContain("supportScore: score");
  });

  it("builds suppressedAnimeTop3 per user", () => {
    expect(source).toContain("suppressedAnimeTop3");
  });

  it("keyVotes sorted by swing desc", () => {
    expect(source).toContain("b.swing - a.swing");
  });

  it("keyVotes limited to 20", () => {
    expect(source).toContain(".slice(0, 20)");
  });

  it("returns empty impact for zero votes", () => {
    expect(source).toContain("createEmptyImpact");
    expect(source).toContain("totalVotes: 0");
    expect(source).toContain("userImpactRanking: []");
  });

  it("currentUserImpact is null when no user ID", () => {
    expect(source).toContain("if (currentUserId)");
  });

  it("currentUserImpact finds user in ranking", () => {
    expect(source).toContain("userImpactRanking.find");
    expect(source).toContain("u.userId === currentUserId");
  });

  it("does not expose email", () => {
    expect(source).not.toContain("email");
    expect(source).not.toContain("password");
  });

  it("does not select email from user", () => {
    const userSelect = source.match(/user.*select.*\{(.*?)\}/s);
    if (userSelect) {
      expect(userSelect[1]).not.toContain("email");
    }
  });
});

describe("Battle season impact API", () => {
  const source = readSource("src/app/api/pools/[poolId]/seasons/[seasonId]/impact/route.ts");

  it("uses getCurrentUser (not require)", () => {
    expect(source).toContain("getCurrentUser");
  });

  it("has NOT handler for anonymous users", () => {
    expect(source).toContain("getCurrentUser");
  });

  it("checks canReadPool", () => {
    expect(source).toContain("canReadPool");
  });

  it("returns notFound for missing pool", () => {
    expect(source).toContain("notFound");
    expect(source).toContain("番组不存在或已归档");
  });

  it("returns forbidden for no permission", () => {
    expect(source).toContain("forbidden");
    expect(source).toContain("你没有权限访问这个番组");
  });

  it("handles SEASON_NOT_FOUND error", () => {
    expect(source).toContain("SEASON_NOT_FOUND");
  });

  it("calls getBattleSeasonImpact with user id", () => {
    expect(source).toContain("getBattleSeasonImpact(poolId, seasonId, user?.id ?? null)");
  });
});

describe("SeasonImpactPanel UI", () => {
  const source = readSource("src/components/SeasonImpactPanel.tsx");

  it("has loading state with skeleton", () => {
    expect(source).toContain("animate-pulse");
  });

  it("has error state", () => {
    expect(source).toContain("ErrorAlert");
  });

  it("has empty state for zero votes", () => {
    expect(source).toContain("还没有足够的投票记录");
  });

  it("shows total stats", () => {
    expect(source).toContain("总投票数");
    expect(source).toContain("参与人数");
    expect(source).toContain("总影响力");
  });

  it("shows private vote count", () => {
    expect(source).toContain("私心票");
  });

  it("has current user impact section", () => {
    expect(source).toContain("我的影响力");
  });

  it("shows rank when user participated", () => {
    expect(source).toContain("排名 #");
    expect(source).toContain("findIndex");
  });

  it("shows 'you haven't participated' when user has no votes", () => {
    expect(source).toContain("你还没有参与这个赛季");
  });

  it("has tab buttons", () => {
    expect(source).toContain("玩家影响力");
    expect(source).toContain("作品支持榜");
    expect(source).toContain("作品打压榜");
    expect(source).toContain("关键投票");
  });

  it("has PlayerImpactTable with columns", () => {
    expect(source).toContain("PlayerImpactTable");
  });

  it("has AnimeSupportTable with cover", () => {
    expect(source).toContain("AnimeSupportTable");
    expect(source).toContain("AnimeCover");
  });

  it("has AnimeSuppressTable", () => {
    expect(source).toContain("AnimeSuppressTable");
  });

  it("has KeyVotesTable", () => {
    expect(source).toContain("KeyVotesTable");
  });

  it("shows bias stats when present", () => {
    expect(source).toContain("私心票统计");
  });

  it("shows 'no bias' when none", () => {
    expect(source).toContain("本赛季还没有人使用私心票");
  });

  it("keyVote shows stepNumber user winner/loser", () => {
    expect(source).toContain("v.stepNumber");
    expect(source).toContain("v.displayName");
    expect(source).toContain("v.winnerTitle");
    expect(source).toContain("v.loserTitle");
    expect(source).toContain("v.totalSwing");
  });

  it("keyVote labels BIAS votes differently", () => {
    expect(source).toContain("使用私心票，让");
    expect(source).toContain("权重 {v.weight}");
  });

  it("does not expose email", () => {
    expect(source).not.toContain("email");
  });
});

describe("Client API impact types", () => {
  const source = readSource("src/lib/client-api.ts");

  it("has UserImpactEntry interface", () => {
    expect(source).toContain("export interface UserImpactEntry");
  });

  it("has BattleSeasonImpact interface", () => {
    expect(source).toContain("export interface BattleSeasonImpact");
  });

  it("has getSeasonImpact client function", () => {
    expect(source).toContain("export function getSeasonImpact");
    expect(source).toContain("/api/pools/${poolId}/seasons/${seasonId}/impact");
  });

  it("client API does not expose email", () => {
    const impactTypes = source.slice(source.indexOf("export interface UserImpactEntry"));
    expect(impactTypes).not.toContain("email");
  });
});

describe("Season detail page integration", () => {
  const source = readSource("src/app/pools/[poolId]/seasons/[seasonId]/page.tsx");

  it("imports SeasonImpactPanel", () => {
    expect(source).toContain("SeasonImpactPanel");
  });

  it("imports getSeasonImpact", () => {
    expect(source).toContain("getSeasonImpact");
  });

  it("renders SeasonImpactPanel with props", () => {
    expect(source).toContain('fetchImpact={getSeasonImpact}');
    expect(source).toContain("poolId={poolId}");
    expect(source).toContain("seasonId={seasonId}");
    expect(source).toContain("status={detail.status}");
  });
});

describe("No migration required", () => {
  it("impact queries only read BattleVote and Season, no new tables", () => {
    const source = readSource("src/lib/server/battle-season-impact.ts");
    expect(source).not.toContain("CREATE TABLE");
    expect(source).not.toContain("ALTER TABLE");
    expect(source).not.toContain("model Battle");
  });
});
