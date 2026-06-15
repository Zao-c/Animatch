import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "fs/promises";
import os from "os";
import path from "path";
import { PoolStatus, Visibility } from "@prisma/client";
import { GET as DISCOVER_ANIME } from "../src/app/api/anime/discover/route";
import { GET as SEARCH_ANIME } from "../src/app/api/anime/search/route";
import { POST as POST_CUSTOM_ITEM } from "../src/app/api/pools/[poolId]/custom-items/route";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/auth-session", () => ({
  requireCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", username: "user-1", name: "User 1", image: null }))
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    customPool: {
      findUnique: vi.fn(),
    },
    anime: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    poolAnime: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
const mockedAnime = vi.mocked(prisma.anime);
const mockedPoolAnime = vi.mocked(prisma.poolAnime);
let tempUploadDir: string;

function pool(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    creatorId: "user-1",
    name: "Pool",
    description: null,
    coverUrl: null,
    visibility: Visibility.PRIVATE,
    status: PoolStatus.DRAFT,
    tags: [],
    sourcePoolId: null,
    affectsGlobalTaste: true,
    allowPublicEdit: false,
    allowCommunityMatch: false,
    isOfficialDemo: false,
    cloneCount: 0,
    useCount: 0,
    likeCount: 0,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function anime(overrides: Record<string, unknown> = {}) {
  return {
    id: "anime-1",
    bgmId: null,
    title: "Custom Image",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    summary: null,
    imageUrl: "/uploads/custom-items/custom.jpg",
    imageSmallUrl: "/uploads/custom-items/custom.jpg",
    imageMediumUrl: "/uploads/custom-items/custom.jpg",
    imageLargeUrl: "/uploads/custom-items/custom.jpg",
    thumbnailUrl: "/uploads/custom-items/custom.jpg",
    airDate: null,
    bangumiRank: null,
    bangumiScore: null,
    bangumiVotes: null,
    tags: ["role"],
    aliases: [],
    year: null,
    season: null,
    animeType: "IMAGE",
    episodes: null,
    status: null,
    studios: [],
    externalLinks: [],
    source: "CUSTOM_UPLOAD",
    sourceId: "custom/pool-1/1",
    rawJson: { customUpload: true, poolId: "pool-1" },
    fetchedAt: null,
    imageStatus: "OK",
    imageCheckedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function poolAnime(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    poolId: "pool-1",
    animeId: "anime-1",
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
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    anime: anime(),
    ...overrides,
  };
}

describe("custom image pool items API", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    tempUploadDir = await mkdtemp(path.join(os.tmpdir(), "animatch-custom-items-"));
    process.env.ANIMATCH_CUSTOM_ITEM_UPLOAD_DIR = tempUploadDir;
  });

  afterEach(async () => {
    delete process.env.ANIMATCH_CUSTOM_ITEM_UPLOAD_DIR;
    await rm(tempUploadDir, { recursive: true, force: true });
  });

  it("uploads a jpg, creates CUSTOM_UPLOAD anime, and joins the pool", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.aggregate.mockResolvedValue({ _max: { position: 2 } } as any);
    mockedAnime.create.mockResolvedValue(
      anime({
        id: "custom-anime-1",
        title: "角色A",
        imageUrl: "/uploads/custom-items/custom.jpg",
        thumbnailUrl: "/uploads/custom-items/custom.jpg",
        source: "CUSTOM_UPLOAD",
        animeType: "IMAGE",
        tags: ["角色", "测试"],
      }) as any
    );
    mockedPoolAnime.create.mockResolvedValue(
      poolAnime({
        animeId: "custom-anime-1",
        position: 3,
        anime: anime({
          id: "custom-anime-1",
          title: "角色A",
          imageUrl: "/uploads/custom-items/custom.jpg",
          thumbnailUrl: "/uploads/custom-items/custom.jpg",
          source: "CUSTOM_UPLOAD",
          animeType: "IMAGE",
          tags: ["角色"],
        }),
      }) as any
    );
    const formData = new FormData();
    formData.set("file", new File([Buffer.from([0xff, 0xd8, 0xff])], "role.jpg", { type: "image/jpeg" }));
    formData.set("title", "角色A");
    formData.set("tags", "角色, 测试");

    const response = await POST_CUSTOM_ITEM(
      new Request("http://test.local/api/pools/pool-1/custom-items", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();
    const files = await readdir(tempUploadDir);

    expect(response.status).toBe(201);
    expect(files).toHaveLength(1);
    expect(mockedAnime.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "角色A",
          source: "CUSTOM_UPLOAD",
          animeType: "IMAGE",
          imageUrl: expect.stringMatching(/^\/uploads\/custom-items\//),
          thumbnailUrl: expect.stringMatching(/^\/uploads\/custom-items\//),
          tags: ["角色", "测试"],
        }),
      })
    );
    expect(mockedPoolAnime.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          poolId: "pool-1",
          position: 3,
        }),
      })
    );
    expect(payload.data.poolAnime.display.coverUrl).toBe("/uploads/custom-items/custom.jpg");
  });

  it("rejects non-image files", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    const formData = new FormData();
    formData.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));

    const response = await POST_CUSTOM_ITEM(
      new Request("http://test.local/api/pools/pool-1/custom-items", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedAnime.create).not.toHaveBeenCalled();
  });

  it("rejects svg uploads", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    const formData = new FormData();
    formData.set("file", new File(["<svg />"], "icon.svg", { type: "image/svg+xml" }));

    const response = await POST_CUSTOM_ITEM(
      new Request("http://test.local/api/pools/pool-1/custom-items", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedAnime.create).not.toHaveBeenCalled();
  });

  it("rejects oversized images", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })
    );

    const response = await POST_CUSTOM_ITEM(
      new Request("http://test.local/api/pools/pool-1/custom-items", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(413);
    expect(mockedAnime.create).not.toHaveBeenCalled();
  });

  it("rejects archived pools", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z"),
      })
    );
    const formData = new FormData();
    formData.set("file", new File([Buffer.from([0xff, 0xd8, 0xff])], "role.jpg", { type: "image/jpeg" }));

    const response = await POST_CUSTOM_ITEM(
      new Request("http://test.local/api/pools/pool-1/custom-items", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1" } }
    );

    expect(response.status).toBe(409);
    expect(mockedAnime.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the pool is missing", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("file", new File([Buffer.from([0xff, 0xd8, 0xff])], "role.jpg", { type: "image/jpeg" }));

    const response = await POST_CUSTOM_ITEM(
      new Request("http://test.local/api/pools/missing/custom-items", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "missing" } }
    );

    expect(response.status).toBe(404);
    expect(mockedAnime.create).not.toHaveBeenCalled();
  });

  it("anime search excludes user-generated entries", async () => {
    mockedAnime.findMany.mockResolvedValue([]);

    await SEARCH_ANIME(new Request("http://test.local/api/anime/search?q=角色&limit=5"));

    expect(mockedAnime.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: {
            notIn: expect.arrayContaining(["CUSTOM_UPLOAD", "MANUAL", "TIERMAKER_IMPORT"]),
          },
        }),
      })
    );
  });

  it("anime discover excludes user-generated entries", async () => {
    mockedAnime.findMany.mockResolvedValue([]);
    vi.mocked(prisma.anime.count).mockResolvedValue(0);

    await DISCOVER_ANIME(new Request("http://test.local/api/anime/discover?limit=5"));

    expect(mockedAnime.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: {
            notIn: expect.arrayContaining(["CUSTOM_UPLOAD", "MANUAL", "TIERMAKER_IMPORT"]),
          },
        }),
      })
    );
    expect(prisma.anime.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: {
            notIn: expect.arrayContaining(["CUSTOM_UPLOAD", "MANUAL", "TIERMAKER_IMPORT"]),
          },
        }),
      })
    );
  });
});

