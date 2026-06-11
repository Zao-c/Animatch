import { Prisma } from "@prisma/client";
import { getAnimeCoverUrl } from "./anime-cover-url";
import { AppError } from "./app-error";
import { prisma } from "./db";
import { getRunTierList, type RunTierListResult, type TierListItem } from "./tier-service";
import {
  DEFAULT_TIER_LABELS,
  normalizeTierLabels,
  TIER_KEYS,
  type TierKey,
  type TierLabels
} from "./tier-labels";

export interface TierShareSnapshotItem {
  animeId: string;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  source: string;
  animeType?: string;
  elo?: number;
  isLocked?: boolean;
  isEdited?: boolean;
}

export interface TierShareSnapshotTier {
  key: TierKey;
  label: string;
  items: TierShareSnapshotItem[];
}

export interface TierShareSnapshot {
  version: 1;
  generatedAt: string;
  pool: {
    id: string;
    name: string;
  };
  run: {
    id: string;
  };
  tiers: TierShareSnapshotTier[];
}

export interface PublicTierShare {
  token: string;
  title: string;
  description: string | null;
  tierLabels: TierLabels;
  snapshot: TierShareSnapshot;
  createdAt: string;
}

export function generateTierShareToken(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

export function sanitizeTierShareDescription(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return null;
  }

  return normalized.slice(0, 500);
}

export function sanitizeTierShareLabels(value: unknown): TierLabels {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_TIER_LABELS;
  }

  return normalizeTierLabels(value as Partial<Record<TierKey, string>>);
}

export function buildTierShareSnapshot(params: {
  poolId: string;
  poolName: string;
  runId: string;
  tierList: RunTierListResult;
  tierLabels: TierLabels;
  generatedAt?: Date;
}): TierShareSnapshot {
  const generatedAt = params.generatedAt ?? new Date();

  return {
    version: 1,
    generatedAt: generatedAt.toISOString(),
    pool: {
      id: params.poolId,
      name: params.poolName
    },
    run: {
      id: params.runId
    },
    tiers: TIER_KEYS.map((tier) => ({
      key: tier,
      label: params.tierLabels[tier],
      items: params.tierList.tiers[tier].map(toSnapshotItem)
    }))
  };
}

export async function createTierShare(params: {
  userId: string;
  poolId: string;
  runId: string;
  tierLabels?: unknown;
  description?: unknown;
}): Promise<{ token: string; url: string; share: PublicTierShare }> {
  if (!params.poolId.trim() || !params.runId.trim()) {
    throw new AppError("poolId and runId are required", 400, "INVALID_SHARE_INPUT");
  }

  const [pool, tierList] = await Promise.all([
    prisma.customPool.findUnique({
      where: {
        id: params.poolId
      },
      select: {
        id: true,
        name: true,
        deletedAt: true
      }
    }),
    getRunTierList({
      userId: params.userId,
      poolId: params.poolId,
      runId: params.runId
    })
  ]);

  if (pool === null || pool.deletedAt !== null) {
    throw new AppError("Pool not found", 404, "POOL_NOT_FOUND");
  }

  const tierLabels = sanitizeTierShareLabels(params.tierLabels);
  const description = sanitizeTierShareDescription(params.description);
  const snapshot = buildTierShareSnapshot({
    poolId: pool.id,
    poolName: pool.name,
    runId: params.runId,
    tierList,
    tierLabels
  });
  const token = generateTierShareToken();

  const share = await prisma.tierShare.create({
    data: {
      token,
      poolId: pool.id,
      runId: params.runId,
      title: pool.name,
      description,
      tierLabels: tierLabels as unknown as Prisma.InputJsonValue,
      snapshot: snapshot as unknown as Prisma.InputJsonValue
    }
  });

  return {
    token,
    url: `/share/tier/${token}`,
    share: toPublicTierShare(share)
  };
}

export async function getPublicTierShare(token: string): Promise<PublicTierShare> {
  if (!isValidShareToken(token)) {
    throw new AppError("Tier share not found", 404, "TIER_SHARE_NOT_FOUND");
  }

  const share = await prisma.tierShare.findUnique({
    where: {
      token
    }
  });

  if (share === null) {
    throw new AppError("Tier share not found", 404, "TIER_SHARE_NOT_FOUND");
  }

  return toPublicTierShare(share);
}

function toSnapshotItem(item: TierListItem): TierShareSnapshotItem {
  const title = item.display?.title ?? item.titleCn ?? item.title;
  const subtitle = item.display?.subtitle ?? item.titleJa ?? item.titleEn ?? undefined;
  const coverUrl = getAnimeCoverUrl(item, { intent: "export" }) ?? undefined;
  const animeType = item.display?.animeType ?? item.animeType ?? undefined;

  return {
    animeId: item.animeId,
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    source: item.source,
    ...(animeType ? { animeType } : {}),
    elo: Number(item.eloScore.toFixed(1)),
    isLocked: item.manualLocked,
    isEdited: item.display?.isOverridden === true
  };
}

function toPublicTierShare(share: {
  token: string;
  title: string;
  description: string | null;
  tierLabels: Prisma.JsonValue;
  snapshot: Prisma.JsonValue;
  createdAt: Date;
}): PublicTierShare {
  return {
    token: share.token,
    title: share.title,
    description: share.description,
    tierLabels: sanitizeTierShareLabels(share.tierLabels),
    snapshot: share.snapshot as unknown as TierShareSnapshot,
    createdAt: share.createdAt.toISOString()
  };
}

function isValidShareToken(token: string): boolean {
  return /^[a-zA-Z0-9_-]{24,80}$/.test(token);
}
