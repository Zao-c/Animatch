import { prisma } from "./db";
import { AppError } from "./app-error";
import { compareTaste, type TasteEntry } from "./taste-analysis";

interface Participant {
  username: string;
  name: string;
  entries: TasteEntry[];
}

export function choosePublicRivalry(participants: Participant[]) {
  let best: {
    left: Pick<Participant, "username" | "name">;
    right: Pick<Participant, "username" | "name">;
    commonCount: number;
    conflictCount: number;
    examples: ReturnType<typeof compareTaste>["disagreements"];
    strength: number;
  } | null = null;
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const result = compareTaste(participants[i].entries, participants[j].entries);
      // A public "rivalry" needs several clear high-versus-low works as evidence.
      if (!result.eligible || result.disagreementCount < 3) continue;
      const strength = result.conflictStrength * result.commonCount / (result.commonCount + 10);
      if (best && (result.disagreementCount < best.conflictCount ||
        (result.disagreementCount === best.conflictCount && strength <= best.strength))) continue;
      best = {
        left: { username: participants[i].username, name: participants[i].name },
        right: { username: participants[j].username, name: participants[j].name },
        commonCount: result.commonCount,
        conflictCount: result.disagreementCount,
        examples: result.disagreements,
        strength
      };
    }
  }
  return best;
}

export async function getPublicTasteRivalry(scopeId: string) {
  const [kind, id, extra] = scopeId.split(":");
  if (!id || extra || (kind !== "pool" && kind !== "season")) throw new AppError("评价范围无效", 400);
  let poolId: string;
  let title: string;
  if (kind === "pool") {
    const pool = await prisma.customPool.findUnique({ where: { id }, select: { id: true, name: true, visibility: true, deletedAt: true } });
    if (!pool || pool.visibility !== "PUBLIC" || pool.deletedAt) throw new AppError("公开番组不存在", 404);
    poolId = pool.id;
    title = pool.name;
  } else {
    const season = await prisma.battleSeason.findUnique({ where: { id }, select: { id: true, title: true, poolId: true,
      pool: { select: { visibility: true, deletedAt: true } } } });
    if (!season || season.pool.visibility !== "PUBLIC" || season.pool.deletedAt) throw new AppError("公开赛季不存在", 404);
    poolId = season.poolId;
    title = season.title;
  }
  const where = { isHidden: false, compareCount: { gt: 0 }, user: { deletedAt: null, username: { not: null } },
    anime: { deletedAt: null } };
  const candidateRows = kind === "pool"
    ? await prisma.userPoolScore.groupBy({ by: ["userId"], where: { ...where, poolId,
      run: { isDefault: true, status: "ACTIVE", deletedAt: null } },
      _count: { animeId: true }, orderBy: { _count: { animeId: "desc" } }, take: 40 })
    : await prisma.battleSeasonUserScore.groupBy({ by: ["userId"], where: { ...where, seasonId: id },
      _count: { animeId: true }, orderBy: { _count: { animeId: "desc" } }, take: 40 });
  const ids = candidateRows.filter((row) => row._count.animeId >= 5).map((row) => row.userId);
  if (!ids.length) return { scopeTitle: title, participantCount: 0, pair: null };
  const rows = kind === "pool"
    ? await prisma.userPoolScore.findMany({ where: { ...where, poolId, userId: { in: ids },
      run: { isDefault: true, status: "ACTIVE", deletedAt: null } },
      select: { userId: true, animeId: true, eloScore: true,
        user: { select: { username: true, name: true } },
        anime: { select: { title: true, titleCn: true } } }, orderBy: { updatedAt: "desc" } })
    : await prisma.battleSeasonUserScore.findMany({ where: { ...where, seasonId: id, userId: { in: ids } },
      select: { userId: true, animeId: true, eloScore: true,
        user: { select: { username: true, name: true } },
        anime: { select: { title: true, titleCn: true } } }, orderBy: { updatedAt: "desc" } });
  const membership = await prisma.poolAnime.findMany({ where: { poolId }, select: { animeId: true } });
  const active = new Set(membership.map((row) => row.animeId));
  const grouped = new Map<string, { username: string; name: string; entries: Map<string, TasteEntry> }>();
  for (const row of rows) {
    if (!row.user.username || !active.has(row.animeId)) continue;
    const person = grouped.get(row.userId) ?? { username: row.user.username,
      name: row.user.name ?? row.user.username, entries: new Map<string, TasteEntry>() };
    if (!person.entries.has(row.animeId)) person.entries.set(row.animeId, {
      animeId: row.animeId, title: row.anime.titleCn ?? row.anime.title,
      imageUrl: null, tags: [], score: row.eloScore
    });
    grouped.set(row.userId, person);
  }
  const participants = [...grouped.values()].map(({ username, name, entries }) => ({ username, name, entries: [...entries.values()] }))
    .filter((person) => person.entries.length >= 5);
  return { scopeTitle: title, participantCount: participants.length, pair: choosePublicRivalry(participants) };
}
