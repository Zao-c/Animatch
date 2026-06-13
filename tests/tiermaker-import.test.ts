import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { POST } from "../src/app/api/pools/[poolId]/anime/tiermaker-import/route";
import { ANIME_SOURCE } from "../src/lib/anime-source";
import {
  makeTierMakerImportBgmId,
  normalizeTierMakerUrl
} from "../src/lib/tiermaker-import";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null }))
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn()
    },
    anime: {
      upsert: vi.fn()
    },
    poolAnime: {
      aggregate: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedAnime = vi.mocked(prisma.anime);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);

function pool(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    creatorId: "user-1",
    name: "TierMaker import test",
    description: null,
    coverUrl: null,
    visibility: Visibility.PRIVATE,
    status: PoolStatus.DRAFT,
    tags: [],
    sourcePoolId: null,
    affectsGlobalTaste: true,
    cloneCount: 0,
    useCount: 0,
    likeCount: 0,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}

function anime(overrides: Record<string, unknown> = {}) {
  return {
    id: "anime-tiermaker-1",
    bgmId: -1800000001,
    title: "TierMaker #001",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    summary: null,
    imageUrl: "https://img.example.test/item-a.png",
    imageSmallUrl: "https://img.example.test/item-a.png",
    imageMediumUrl: "https://img.example.test/item-a.png",
    imageLargeUrl: "https://img.example.test/item-a.png",
    thumbnailUrl: "https://img.example.test/item-a.png",
    airDate: null,
    bangumiRank: null,
    bangumiScore: null,
    bangumiVotes: null,
    tags: ["tiermaker", "imported", "Template"],
    aliases: [],
    year: null,
    season: null,
    animeType: null,
    episodes: null,
    status: null,
    studios: [],
    externalLinks: ["https://tiermaker.com/create/template", "https://img.example.test/item-a.png"],
    source: ANIME_SOURCE.TIERMAKER_IMPORT,
    sourceId: "tiermaker/1800000001",
    rawJson: null,
    fetchedAt: null,
    imageStatus: "OK",
    imageCheckedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides
  };
}

function poolAnime(overrides: Record<string, unknown> = {}) {
  const animeRecord = anime();

  return {
    id: `entry-${animeRecord.id}`,
    poolId: "pool-1",
    animeId: animeRecord.id,
    position: 1,
    note: null,
    initialElo: 1500,
    displayTitleOverride: null,
    coverUrlOverride: null,
    animeTypeOverride: null,
    tagsOverride: [],
    overrideNote: null,
    overrideUpdatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    anime: animeRecord,
    ...overrides
  };
}

const requestBody = {
  templateUrl: "https://tiermaker.com/create/template?b=2&a=1#top",
  templateName: "Template",
  items: [
    {
      title: "Imported A",
      imageUrl: "https://img.example.test/item-a.png",
      index: 0
    },
    {
      title: "Imported B",
      imageUrl: "https://img.example.test/item-b.png",
      index: 1
    }
  ]
};

describe("TierMaker import source type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCustomPool.findUnique.mockResolvedValue(pool() as any);
    mockedPoolAnime.aggregate.mockResolvedValue({ _max: { position: 2 } } as any);
    mockedPoolAnime.findUnique.mockResolvedValue(null);
    (mockedAnime.upsert as any).mockImplementation(async (args: any) =>
      anime({
        id: `anime-${Math.abs(args.where.bgmId)}`,
        bgmId: args.where.bgmId,
        title: args.create.title,
        titleCn: args.create.titleCn,
        imageUrl: args.create.imageUrl,
        imageSmallUrl: args.create.imageSmallUrl,
        imageMediumUrl: args.create.imageMediumUrl,
        imageLargeUrl: args.create.imageLargeUrl,
        thumbnailUrl: args.create.thumbnailUrl,
        tags: args.create.tags,
        aliases: args.create.aliases,
        externalLinks: args.create.externalLinks,
        source: args.create.source,
        sourceId: args.create.sourceId,
        imageStatus: args.create.imageStatus
      })
    );
    (mockedPoolAnime.create as any).mockImplementation(async (args: any) =>
      poolAnime({
        animeId: args.data.animeId,
        position: args.data.position,
        anime: anime({
          id: args.data.animeId,
          title: args.data.animeId.includes("2") ? "Imported B" : "Imported A"
        })
      })
    );
  });

  it("normalizes URLs and creates a stable reserved fake bgmId", () => {
    const templateUrl = normalizeTierMakerUrl("https://tiermaker.com/create/template?b=2&a=1#top");
    const first = makeTierMakerImportBgmId({
      templateUrl,
      imageUrl: "https://img.example.test/item-a.png",
      index: 0
    });
    const second = makeTierMakerImportBgmId({
      templateUrl,
      imageUrl: "https://img.example.test/item-a.png",
      index: 0
    });

    expect(templateUrl).toBe("https://tiermaker.com/create/template?a=1&b=2");
    expect(first).toBe(second);
    expect(first).toBeLessThanOrEqual(-1_800_000_001);
    expect(first).toBeGreaterThanOrEqual(-1_900_000_000);
  });

  it("creates Anime with TIERMAKER_IMPORT instead of CUSTOM_UPLOAD", async () => {
    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(requestBody)
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.importedCount).toBe(2);
    expect(ANIME_SOURCE.TIERMAKER_IMPORT).toBe("TIERMAKER_IMPORT");
    expect(mockedAnime.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: ANIME_SOURCE.TIERMAKER_IMPORT,
          sourceId: expect.stringMatching(/^tiermaker\//),
          rawJson: expect.objectContaining({
            sourceType: ANIME_SOURCE.TIERMAKER_IMPORT
          })
        }),
        update: expect.objectContaining({
          source: ANIME_SOURCE.TIERMAKER_IMPORT
        })
      })
    );
    expect(mockedAnime.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: ANIME_SOURCE.CUSTOM_UPLOAD
        })
      })
    );
  });

  it("does not create duplicate PoolAnime rows for a repeated TierMaker import", async () => {
    await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(requestBody)
      }),
      { params: { poolId: "pool-1" } }
    );

    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime() as any);

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(requestBody)
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.importedCount).toBe(0);
    expect(payload.data.skippedCount).toBe(2);
    expect(mockedPoolAnime.create).toHaveBeenCalledTimes(2);
  });

  it("rejects archived pools", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({ status: PoolStatus.ARCHIVED, deletedAt: new Date("2026-01-02T00:00:00.000Z") }) as any
    );

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(requestBody)
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedAnime.upsert).not.toHaveBeenCalled();
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
  });
});
