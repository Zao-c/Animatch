import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth-session";
import { isAdminEditSession } from "@/lib/admin-auth";
import { canEditPoolContent } from "@/lib/pool-permissions";
import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";

const ANIME_TYPES = new Set([
  "TV",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "MUSIC",
  "CM",
  "PV",
  "UNKNOWN"
]);

const MAX_TITLE_LENGTH = 120;
const MAX_NOTE_LENGTH = 500;

interface BatchUpdateBody {
  poolAnimeIds?: unknown;
  displayTitleOverride?: unknown;
  animeTypeOverride?: unknown;
  overrideNote?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const user = await requireCurrentUser();

    const pool = await prisma.customPool.findUnique({
      where: {
        id: params.poolId
      }
    });

    if (pool === null || pool.deletedAt !== null) {
      return notFound("Pool not found");
    }

    if (!canEditPoolContent(pool, user) && !(await isAdminEditSession(user))) {
      return forbidden("你没有权限管理这个番组。");
    }

    const body: BatchUpdateBody = await request.json();

    if (!Array.isArray(body?.poolAnimeIds) || body.poolAnimeIds.length === 0) {
      return badRequest("poolAnimeIds 必须是非空数组。");
    }

    const poolAnimeIds = body.poolAnimeIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );

    if (poolAnimeIds.length === 0) {
      return badRequest("poolAnimeIds 必须是非空数组。");
    }

    const data: Prisma.PoolAnimeUpdateInput = {};

    if (Object.prototype.hasOwnProperty.call(body, "displayTitleOverride")) {
      const value = normalizeOptionalString(body.displayTitleOverride);
      if (value instanceof Error) {
        return badRequest("标题必须是字符串。");
      }
      if (value !== null && value.length > MAX_TITLE_LENGTH) {
        return badRequest(`标题最多 ${MAX_TITLE_LENGTH} 个字符。`);
      }
      data.displayTitleOverride = value;
    }

    if (Object.prototype.hasOwnProperty.call(body, "animeTypeOverride")) {
      const value = normalizeOptionalString(body.animeTypeOverride);
      if (value instanceof Error) {
        return badRequest("类型必须是字符串。");
      }
      if (value !== null && !ANIME_TYPES.has(value)) {
        return badRequest("类型不在允许的取值范围内。");
      }
      data.animeTypeOverride = value;
    }

    if (Object.prototype.hasOwnProperty.call(body, "overrideNote")) {
      const value = normalizeOptionalString(body.overrideNote);
      if (value instanceof Error) {
        return badRequest("备注必须是字符串。");
      }
      if (value !== null && value.length > MAX_NOTE_LENGTH) {
        return badRequest(`备注最多 ${MAX_NOTE_LENGTH} 个字符。`);
      }
      data.overrideNote = value;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("没有需要更新的字段。");
    }

    const existingEntries = await prisma.poolAnime.findMany({
      where: {
        id: { in: poolAnimeIds },
        poolId: pool.id
      },
      select: { id: true }
    });

    if (existingEntries.length === 0) {
      return badRequest("提供的作品 ID 均不属于当前番组。");
    }

    const validIds = existingEntries.map((entry: { id: string }) => entry.id);

    const result = await prisma.poolAnime.updateMany({
      where: {
        id: { in: validIds },
        poolId: pool.id
      },
      data
    });

    return ok({
      updated: result.count
    });
  } catch (error) {
    return fromError(error);
  }
}

function normalizeOptionalString(value: unknown): string | null | Error {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return new Error("expected string");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
