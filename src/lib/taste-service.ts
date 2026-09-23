import { prisma } from "./db";
import { AppError } from "./app-error";
import { getAnimeCoverUrl } from "./anime-cover-url";
import { buildTasteProfile, compareTaste, type TasteEntry } from "./taste-analysis";

export async function tasteScopes(userId: string, year?: number) {
  const poolFilter = { visibility: "PUBLIC" as const, deletedAt: null, affectsGlobalTaste: true, status: { not: "ARCHIVED" as const } };
  const after = year ? { gte: new Date(`${year}-01-01T00:00:00+08:00`), lt: new Date(`${year + 1}-01-01T00:00:00+08:00`) } : undefined;
  const [runs, seasons] = await Promise.all([
    prisma.userPoolScore.findMany({ where: { userId, isHidden: false, compareCount: { gt: 0 },
      lastComparedAt: after, pool: poolFilter, anime: { deletedAt: null },
      run: { isDefault: true, status: "ACTIVE", deletedAt: null } },
      include: { anime: true, pool: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.battleSeasonUserScore.findMany({ where: { userId, isHidden: false, compareCount: { gt: 0 },
      lastVotedAt: after, pool: poolFilter, anime: { deletedAt: null } },
      include: { anime: true, season: { select: { title: true } } }, orderBy: { updatedAt: "desc" } })
  ]);
  const scopes = new Map<string, { id: string; title: string; poolId: string; entries: TasteEntry[] }>();
  for (const row of [...runs, ...seasons]) {
    const key = "seasonId" in row ? `season:${row.seasonId}` : `pool:${row.poolId}`;
    const scope = scopes.get(key) ?? { id: key, title: "season" in row ? row.season.title : row.pool.name, poolId: row.poolId, entries: [] };
    // Protect against historical duplicate default runs and removed pool entries below.
    if (!scope.entries.some((entry) => entry.animeId === row.animeId)) scope.entries.push({
      animeId: row.animeId, title: row.anime.titleCn ?? row.anime.title,
      imageUrl: getAnimeCoverUrl(row.anime), tags: row.anime.tags, score: row.eloScore
    });
    scopes.set(key, scope);
  }
  const membership = await prisma.poolAnime.findMany({ where: { poolId: { in: [...new Set([...scopes.values()].map((scope) => scope.poolId))] } }, select: { poolId: true, animeId: true } });
  const active = new Set(membership.map((row) => `${row.poolId}:${row.animeId}`));
  return [...scopes.values()].map((scope) => ({ ...scope, entries: scope.entries.filter((entry) => active.has(`${scope.poolId}:${entry.animeId}`)) })).filter((scope) => scope.entries.length > 0);
}

export async function getTasteProfile(username: string, viewerId?: string, year?: number) {
  const user = await prisma.user.findFirst({ where: { username, deletedAt: null },
    select: { id: true } });
  if (!user) throw new AppError("用户不存在", 404);
  const isOwner = user.id === viewerId;
  const scopes = await tasteScopes(user.id, year);
  return { isOwner, visible: true, profile: buildTasteProfile(scopes.map((scope) => scope.entries)),
    scopes: scopes.map(({ id, title, entries }) => ({ id, title, count: entries.length })) };
}

export async function findTasteMatches(userId: string, scopeId: string) {
  const myScopes = await tasteScopes(userId);
  const mine = myScopes.find((scope) => scope.id === scopeId);
  if (!mine) throw new AppError("请选择你参与过的公开番组或赛季", 400);
  const eligibleUser = { deletedAt: null, id: { not: userId } };
  const commonWhere = { user: eligibleUser, isHidden: false, compareCount: { gt: 0 }, animeId: { in: mine.entries.map((entry) => entry.animeId) } };
  const candidateRows = scopeId.startsWith("season:")
    ? await prisma.battleSeasonUserScore.groupBy({ by: ["userId"], where: { ...commonWhere, seasonId: scopeId.slice(7) }, _count: { animeId: true }, orderBy: { _count: { animeId: "desc" } }, take: 100 })
    : await prisma.userPoolScore.groupBy({ by: ["userId"], where: { ...commonWhere, poolId: mine.poolId, run: { isDefault: true, status: "ACTIVE", deletedAt: null } }, _count: { animeId: true }, orderBy: { _count: { animeId: "desc" } }, take: 100 });
  const ids = candidateRows.filter((row) => row._count.animeId >= 5).map((row) => row.userId);
  // One bounded query, rather than loading every candidate's entire history.
  const rows = scopeId.startsWith("season:")
    ? await prisma.battleSeasonUserScore.findMany({ where: { seasonId: scopeId.slice(7), userId: { in: ids }, user: eligibleUser, isHidden: false, compareCount: { gt: 0 } }, include: { anime: true, user: { select: { username: true, name: true } } } })
    : await prisma.userPoolScore.findMany({ where: { poolId: mine.poolId, userId: { in: ids }, user: eligibleUser, isHidden: false, compareCount: { gt: 0 }, run: { isDefault: true, status: "ACTIVE", deletedAt: null } }, include: { anime: true, user: { select: { username: true, name: true } } }, orderBy: { updatedAt: "desc" } });
  const membership = await prisma.poolAnime.findMany({ where: { poolId: mine.poolId }, select: { animeId: true } });
  const active = new Set(membership.map((row) => row.animeId));
  const grouped = new Map<string, { username: string; name: string; entries: Map<string, TasteEntry> }>();
  for (const row of rows) {
    if (!row.user.username || !active.has(row.animeId) || row.anime.deletedAt) continue;
    const entry = grouped.get(row.userId) ?? { username: row.user.username, name: row.user.name ?? row.user.username, entries: new Map() };
    if (!entry.entries.has(row.animeId)) entry.entries.set(row.animeId, { animeId: row.animeId, title: row.anime.titleCn ?? row.anime.title, tags: [], imageUrl: null, score: row.eloScore });
    grouped.set(row.userId, entry);
  }
  const matches = [...grouped.values()].map((entry) => ({ username: entry.username, name: entry.name, ...compareTaste(mine.entries, [...entry.entries.values()]) }))
    .filter((match) => match.eligible);
  const alreadyRated = new Set(myScopes.flatMap((scope) => scope.entries.map((entry) => entry.animeId)));
  const recommendationIds = [...new Set(matches.flatMap((match) => match.recommendations.map((item) => item.animeId)))].filter((id) => !alreadyRated.has(id));
  const [statuses, otherPoolScores, otherSeasonScores] = recommendationIds.length ? await Promise.all([
    prisma.userAnimeStatus.findMany({ where: { userId, animeId: { in: recommendationIds } }, select: { animeId: true, status: true } }),
    prisma.userPoolScore.findMany({ where: { userId, animeId: { in: recommendationIds }, compareCount: { gt: 0 } }, select: { animeId: true } }),
    prisma.battleSeasonUserScore.findMany({ where: { userId, animeId: { in: recommendationIds }, compareCount: { gt: 0 } }, select: { animeId: true } })
  ]) : [[], [], []];
  for (const row of [...otherPoolScores, ...otherSeasonScores]) alreadyRated.add(row.animeId);
  const statusByAnime = new Map(statuses.map((row) => [row.animeId, row.status]));
  const visibleMatches = matches.map((match) => ({ ...match, recommendations: match.recommendations
    .filter((item) => !alreadyRated.has(item.animeId) && !["WATCHED", "WATCHING", "DROPPED"].includes(statusByAnime.get(item.animeId) ?? ""))
    .slice(0, 3)
    .map((item) => ({ ...item, markedUnseen: statusByAnime.get(item.animeId) === "UNSEEN" })) }));
  const closestCount = Math.min(3, Math.ceil(visibleMatches.length / 2));
  const closest = [...visibleMatches].sort((a, b) => b.adjustedSimilarity! - a.adjustedSimilarity! || b.agreementCount - a.agreementCount || b.commonCount - a.commonCount).slice(0, closestCount);
  const shown = new Set(closest.map((item) => item.username));
  const furthest = visibleMatches.filter((item) => !shown.has(item.username))
    .sort((a, b) => b.disagreementCount - a.disagreementCount || b.conflictStrength - a.conflictStrength || a.adjustedSimilarity! - b.adjustedSimilarity!)
    .slice(0, Math.min(3, visibleMatches.length - closestCount));
  return { scopeTitle: mine.title, candidateLimit: 100, candidateCount: visibleMatches.length, closest, furthest };
}
