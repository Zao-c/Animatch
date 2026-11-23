import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { AppError } from "./app-error";
import { prisma } from "./db";
import { poolAnimePublicAnimeSelect, serializePoolAnime } from "./pool-anime-serializer";
import { assertRunAccess, type RunAccessParams } from "./run-service";

async function readCandidates(tx: Prisma.TransactionClient, params: RunAccessParams) {
  const run = await assertRunAccess(params, tx);
  const entries = await tx.poolAnime.findMany({ where: { poolId: params.poolId }, orderBy: { position: "asc" },
    include: { anime: { select: poolAnimePublicAnimeSelect } } });
  const hidden = await tx.userPoolScore.findMany({ where: { ...params, isHidden: true }, select: { animeId: true } });
  const poolIds = new Set(entries.map((entry) => entry.animeId));
  const hiddenAnimeIds = hidden.map((row) => row.animeId).filter((id) => poolIds.has(id)).sort();
  const excludedAnimeIds = run.matchExcludedAnimeIds.filter((id) => poolIds.has(id)).sort();
  const version = createHash("sha256").update(JSON.stringify([[...poolIds].sort(), hiddenAnimeIds, excludedAnimeIds])).digest("hex");
  return { ownerId: params.userId, anime: entries.map(serializePoolAnime), hiddenAnimeIds, excludedAnimeIds, version };
}

export function getPersonalMatchCandidates(params: RunAccessParams) {
  return prisma.$transaction((tx) => readCandidates(tx, params), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function replacePersonalMatchCandidates(params: RunAccessParams, input: { includedAnimeIds: string[]; expectedVersion: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await readCandidates(tx, params);
      const hidden = new Set(current.hiddenAnimeIds);
      const available = current.anime.filter((item) => !hidden.has(item.animeId)).map((item) => item.animeId);
      const availableSet = new Set(available);
      const included = new Set(input.includedAnimeIds);
      if ([...included].some((id) => !availableSet.has(id))) throw new AppError("作品或没看过状态已变化，请重新加载清单。", 409, "MATCH_CANDIDATES_CHANGED");
      if (included.size < Math.min(2, available.length)) throw new AppError("至少选择 2 部可参与对决的作品。", 400, "NOT_ENOUGH_CANDIDATES");
      // Preserve explicit exclusions of hidden works, so undoing an unseen vote
      // does not accidentally discard the previously chosen match scope.
      const excluded = [...new Set([...available.filter((id) => !included.has(id)), ...current.excludedAnimeIds.filter((id) => hidden.has(id))])].sort();
      if (JSON.stringify(excluded) === JSON.stringify(current.excludedAnimeIds)) return current;
      if (input.expectedVersion !== current.version) throw new AppError("其他页面已修改作品范围或没看过状态，请重新加载清单后再保存。", 409, "MATCH_CANDIDATES_CHANGED");
      await tx.personalRun.update({ where: { id: params.runId }, data: { matchExcludedAnimeIds: excluded } });
      return readCandidates(tx, params);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new AppError("对决状态正在更新，请重试保存；选择已保留。", 409, "MATCH_CANDIDATES_BUSY");
    throw error;
  }
}
