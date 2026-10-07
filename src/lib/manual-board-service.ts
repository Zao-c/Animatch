import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./app-error";
import { canReadPool } from "./pool-permissions";
import { getEffectiveAnimeDisplay } from "./anime-display";
import { resolveTierRows, type PoolTierConfig } from "./tier-config";
import { buildManualBoardShare, validateManualBoard, type ManualBoardData, type ManualBoardLayout } from "./manual-board";
import type { PublicTierShare } from "./client-api";

export async function getManualBoard(ownerId: string, poolId: string): Promise<ManualBoardData> {
  const pool = await prisma.customPool.findUnique({ where: { id: poolId }, include: {
    poolAnime: { orderBy: { position: "asc" }, include: { anime: true } }
  } });
  if (!pool || pool.deletedAt || !canReadPool(pool, { id: ownerId })) throw new AppError("番组不存在或无法访问。", 404, "POOL_NOT_FOUND");
  const saved = await prisma.manualTierBoard.findUnique({ where: { ownerId_poolId: { ownerId, poolId } } });
  const rows = resolveTierRows(pool.tierConfig as unknown as PoolTierConfig | null);
  const layout = saved?.layout as unknown as ManualBoardLayout | undefined;
  const activeIds = new Set(pool.poolAnime.map((entry) => entry.animeId));
  return {
    pool: { id: pool.id, name: pool.name }, title: saved?.title ?? `${pool.name} · 我的 Tier List`.slice(0, 100),
    revision: saved?.revision ?? 0,
    layout: layout ? { ...layout, tiers: Object.fromEntries(layout.rows.map((row) => [row.id, (layout.tiers[row.id] ?? []).filter((id) => activeIds.has(id))])) }
      : { rows, tiers: Object.fromEntries(rows.map((row) => [row.id, []])) },
    items: pool.poolAnime.map((entry) => {
      const display = getEffectiveAnimeDisplay(entry);
      return { animeId: entry.animeId, title: display.title, coverUrl: display.coverUrl,
        imageUrl: entry.anime.imageUrl, imageLargeUrl: entry.anime.imageLargeUrl,
        imageMediumUrl: entry.anime.imageMediumUrl, imageSmallUrl: entry.anime.imageSmallUrl,
        thumbnailUrl: entry.anime.thumbnailUrl, source: entry.anime.source, animeType: display.animeType ?? undefined };
    }),
    shareUrl: saved?.shareToken ? `/tierlists/share/${saved.shareToken}` : null
  };
}

export async function saveManualBoard(ownerId: string, poolId: string, input: unknown, publish = false) {
  const current = await getManualBoard(ownerId, poolId);
  let parsed: ReturnType<typeof validateManualBoard>;
  try { parsed = validateManualBoard(input, new Set(current.items.map((item) => item.animeId))); }
  catch (error) { throw new AppError(error instanceof Error ? error.message : "榜单内容无效。", 400, "INVALID_BOARD"); }
  const conflict = () => new AppError("这份榜单已在其他页面更新。请刷新后再编辑，避免覆盖。", 409, "BOARD_CONFLICT");
  if (parsed.revision !== current.revision) throw conflict();
  const share = publish ? buildManualBoardShare({ ...current, ...parsed }) : null;
  if (share && share.snapshot.animeCount === 0) throw new AppError("请先把至少一部作品放入档位。", 400, "EMPTY_BOARD");
  const data = {
    title: parsed.title, layout: parsed.layout as unknown as Prisma.InputJsonValue,
    ...(share ? { sharedSnapshot: share as unknown as Prisma.InputJsonValue,
      shareToken: current.shareUrl?.split("/").pop() ?? crypto.randomUUID().replace(/-/g, "") } : {})
  };
  try {
    if (current.revision === 0) {
      await prisma.manualTierBoard.create({ data: { ownerId, poolId, ...data } });
    } else {
      const result = await prisma.manualTierBoard.updateMany({ where: { ownerId, poolId, revision: parsed.revision },
        data: { ...data, revision: { increment: 1 } } });
      if (result.count !== 1) throw conflict();
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict();
    throw error;
  }
  return { revision: parsed.revision + 1, shareUrl: data.shareToken ? `/tierlists/share/${data.shareToken}` : current.shareUrl };
}

export async function revokeManualBoardShare(ownerId: string, poolId: string) {
  await getManualBoard(ownerId, poolId);
  await prisma.manualTierBoard.updateMany({ where: { ownerId, poolId }, data: {
    shareToken: null, sharedSnapshot: Prisma.DbNull, revision: { increment: 1 }
  } });
  return getManualBoard(ownerId, poolId);
}

export async function getSharedManualBoard(token: string): Promise<PublicTierShare | null> {
  const board = await prisma.manualTierBoard.findUnique({ where: { shareToken: token }, include: {
    owner: { select: { deletedAt: true } }, pool: { select: { deletedAt: true } }
  } });
  if (!board || board.owner.deletedAt || board.pool.deletedAt || !board.sharedSnapshot) return null;
  return { ...(board.sharedSnapshot as unknown as PublicTierShare), token };
}
