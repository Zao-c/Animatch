import { createHash } from "crypto";
import { PoolStatus, Prisma } from "@prisma/client";
import { ANIME_SOURCE } from "./anime-source";
import { prisma } from "./db";
import { serializePoolAnime } from "./pool-anime-serializer";

const TIERMAKER_BGM_ID_BASE = -1_900_000_000;
const TIERMAKER_BGM_ID_SPAN = 100_000_000;
const MAX_TIERMAKER_ITEMS = 80;

export interface TierMakerImportItemInput {
  title?: unknown;
  titleCn?: unknown;
  imageUrl?: unknown;
  index?: unknown;
  tags?: unknown;
}

export interface TierMakerImportInput {
  templateUrl?: unknown;
  templateName?: unknown;
  items?: unknown;
}

export function normalizeTierMakerUrl(value: string): string {
  const url = new URL(value.trim());
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  url.searchParams.sort();
  return url.toString();
}

export function makeTierMakerImportBgmId(params: {
  templateUrl: string;
  imageUrl?: string | null;
  index: number;
}): number {
  const key = [
    normalizeTierMakerUrl(params.templateUrl),
    params.imageUrl ? normalizeTierMakerUrl(params.imageUrl) : `index:${params.index}`
  ].join("|");
  const hash = createHash("sha256").update(key).digest();
  const value = hash.readUInt32BE(0) % TIERMAKER_BGM_ID_SPAN;
  return TIERMAKER_BGM_ID_BASE + value;
}

export function parseTierMakerImportInput(input: TierMakerImportInput) {
  if (typeof input.templateUrl !== "string" || !input.templateUrl.trim()) {
    throw new Error("templateUrl is required");
  }

  let templateUrl: string;
  try {
    templateUrl = normalizeTierMakerUrl(input.templateUrl);
  } catch {
    throw new Error("templateUrl must be a valid URL");
  }

  const templateName =
    typeof input.templateName === "string" && input.templateName.trim()
      ? input.templateName.trim().slice(0, 80)
      : "TierMaker";

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("items are required");
  }

  if (input.items.length > MAX_TIERMAKER_ITEMS) {
    throw new Error(`items cannot contain more than ${MAX_TIERMAKER_ITEMS} entries`);
  }

  return {
    templateUrl,
    templateName,
    items: input.items.map((item, itemIndex) =>
      normalizeTierMakerItem(item as TierMakerImportItemInput, templateUrl, templateName, itemIndex)
    )
  };
}

export async function importTierMakerItemsToPool(params: {
  poolId: string;
  userId: string;
  input: TierMakerImportInput;
}) {
  const parsed = parseTierMakerImportInput(params.input);
  const pool = await prisma.customPool.findUnique({
    where: {
      id: params.poolId
    }
  });

  if (pool === null) {
    throw new Error("Pool not found");
  }

  if (pool.creatorId !== params.userId) {
    throw new Error("Pool does not belong to the current dev user");
  }

  if (pool.deletedAt !== null || pool.status === PoolStatus.ARCHIVED) {
    throw new Error("Archived pools cannot import TierMaker items");
  }

  const maxPosition = await prisma.poolAnime.aggregate({
    where: {
      poolId: pool.id
    },
    _max: {
      position: true
    }
  });
  let nextPosition = (maxPosition._max.position ?? 0) + 1;
  const added = [];
  const skipped = [];

  for (const item of parsed.items) {
    const anime = await prisma.anime.upsert({
      where: {
        bgmId: item.bgmId
      },
      create: {
        bgmId: item.bgmId,
        title: item.title,
        titleCn: item.titleCn,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.imageUrl,
        imageSmallUrl: item.imageUrl,
        imageMediumUrl: item.imageUrl,
        imageLargeUrl: item.imageUrl,
        tags: item.tags,
        aliases: item.titleCn ? [item.titleCn] : [],
        studios: [],
        externalLinks: [parsed.templateUrl, item.imageUrl],
        source: ANIME_SOURCE.TIERMAKER_IMPORT,
        sourceId: item.sourceId,
        rawJson: {
          sourceType: ANIME_SOURCE.TIERMAKER_IMPORT,
          sourceUrl: parsed.templateUrl,
          imageUrl: item.imageUrl,
          index: item.index,
          templateName: parsed.templateName
        } satisfies Prisma.InputJsonObject,
        imageStatus: item.imageUrl ? "OK" : "MISSING"
      },
      update: {
        title: item.title,
        titleCn: item.titleCn,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.imageUrl,
        imageSmallUrl: item.imageUrl,
        imageMediumUrl: item.imageUrl,
        imageLargeUrl: item.imageUrl,
        tags: item.tags,
        aliases: item.titleCn ? [item.titleCn] : [],
        externalLinks: [parsed.templateUrl, item.imageUrl],
        source: ANIME_SOURCE.TIERMAKER_IMPORT,
        sourceId: item.sourceId,
        rawJson: {
          sourceType: ANIME_SOURCE.TIERMAKER_IMPORT,
          sourceUrl: parsed.templateUrl,
          imageUrl: item.imageUrl,
          index: item.index,
          templateName: parsed.templateName
        } satisfies Prisma.InputJsonObject,
        imageStatus: item.imageUrl ? "OK" : "MISSING"
      }
    });

    const existingEntry = await prisma.poolAnime.findUnique({
      where: {
        poolId_animeId: {
          poolId: pool.id,
          animeId: anime.id
        }
      },
      include: {
        anime: true
      }
    });

    if (existingEntry !== null) {
      skipped.push(serializePoolAnime(existingEntry));
      continue;
    }

    const createdEntry = await prisma.poolAnime.create({
      data: {
        poolId: pool.id,
        animeId: anime.id,
        position: nextPosition
      },
      include: {
        anime: true
      }
    });
    nextPosition += 1;
    added.push(serializePoolAnime(createdEntry));
  }

  return {
    added,
    skipped,
    importedCount: added.length,
    skippedCount: skipped.length
  };
}

function normalizeTierMakerItem(
  input: TierMakerImportItemInput,
  templateUrl: string,
  templateName: string,
  fallbackIndex: number
) {
  const index = normalizeIndex(input.index, fallbackIndex);
  const imageUrl = normalizeRequiredUrl(input.imageUrl, "imageUrl");
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim().slice(0, 120)
      : `${templateName} #${String(index + 1).padStart(3, "0")}`;
  const titleCn =
    typeof input.titleCn === "string" && input.titleCn.trim()
      ? input.titleCn.trim().slice(0, 120)
      : null;
  const tags = normalizeTags(input.tags, templateName);
  const bgmId = makeTierMakerImportBgmId({
    templateUrl,
    imageUrl,
    index
  });

  return {
    bgmId,
    index,
    title,
    titleCn,
    imageUrl,
    tags,
    sourceId: `tiermaker/${Math.abs(bgmId)}`
  };
}

function normalizeIndex(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return fallback;
  }

  return value;
}

function normalizeRequiredUrl(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  try {
    return normalizeTierMakerUrl(value);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
}

function normalizeTags(value: unknown, templateName: string) {
  const extraTags = Array.isArray(value)
    ? value
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  const templateTag = templateName.trim().slice(0, 40);
  return Array.from(new Set(["tiermaker", "imported", templateTag, ...extraTags]));
}
