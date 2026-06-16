import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm, stat, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { PoolStatus, Visibility } from "@prisma/client";
import { PATCH } from "../src/app/api/pools/[poolId]/anime/[animeId]/route";
import { POST as POST_COVER } from "../src/app/api/pools/[poolId]/anime/[animeId]/cover/route";
import { DELETE as DELETE_OVERRIDES } from "../src/app/api/pools/[poolId]/anime/[animeId]/overrides/route";
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
    poolAnime: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockedCustomPool = vi.mocked(prisma.customPool);
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
    title: "Original Title",
    titleCn: null,
    titleJa: null,
    titleEn: null,
    summary: null,
    imageUrl: "https://example.com/original.jpg",
    imageSmallUrl: null,
    imageMediumUrl: null,
    imageLargeUrl: null,
    thumbnailUrl: null,
    airDate: null,
    bangumiRank: null,
    bangumiScore: null,
    bangumiVotes: null,
    tags: ["action"],
    aliases: [],
    year: null,
    season: null,
    animeType: "TV",
    episodes: null,
    status: null,
    studios: [],
    externalLinks: [],
    source: "MANAMI",
    sourceId: "anime-1",
    rawJson: null,
    fetchedAt: null,
    imageStatus: "UNKNOWN",
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

describe("pool anime display override API", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    tempUploadDir = await mkdtemp(path.join(os.tmpdir(), "animatch-covers-"));
    process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR = tempUploadDir;
  });

  afterEach(async () => {
    delete process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR;
    await rm(tempUploadDir, { recursive: true, force: true });
  });

  it("PATCH sets displayTitleOverride", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime());
    mockedPoolAnime.update.mockResolvedValue(
      poolAnime({
        displayTitleOverride: "手动标题",
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({ displayTitleOverride: "手动标题" }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.display.title).toBe("手动标题");
    expect(mockedPoolAnime.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayTitleOverride: "手动标题",
          overrideUpdatedAt: expect.any(Date),
        }),
      })
    );
  });

  it("PATCH sets coverUrlOverride", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime());
    mockedPoolAnime.update.mockResolvedValue(
      poolAnime({
        coverUrlOverride: "https://example.com/cover.jpg",
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({ coverUrlOverride: "https://example.com/cover.jpg" }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.display.coverUrl).toBe("https://example.com/cover.jpg");
  });

  it("PATCH rejects non-http cover URL", async () => {
    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({ coverUrlOverride: "ftp://example.com/cover.jpg" }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });

  it("PATCH accepts local uploaded cover paths", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime());
    mockedPoolAnime.update.mockResolvedValue(
      poolAnime({
        coverUrlOverride: "/uploads/anime-covers/pool-1-anime-1-cover.webp",
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({
          coverUrlOverride: "/uploads/anime-covers/pool-1-anime-1-cover.webp",
        }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(200);
  });

  it("PATCH returns 404 when anime is not in the pool", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/missing", {
        method: "PATCH",
        body: JSON.stringify({ displayTitleOverride: "Missing" }),
      }),
      { params: { poolId: "pool-1", animeId: "missing" } }
    );

    expect(response.status).toBe(404);
  });

  it("PATCH rejects archived pools", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z"),
      })
    );

    const response = await PATCH(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1", {
        method: "PATCH",
        body: JSON.stringify({ displayTitleOverride: "Archived" }),
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(403);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });

  it("DELETE overrides restores original display", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(
      poolAnime({
        displayTitleOverride: "手动标题",
        tagsOverride: ["动作"],
      })
    );
    mockedPoolAnime.update.mockResolvedValue(poolAnime());

    const response = await DELETE_OVERRIDES(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/overrides", {
        method: "DELETE",
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.display.title).toBe("Original Title");
    expect(mockedPoolAnime.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayTitleOverride: null,
          coverUrlOverride: null,
          animeTypeOverride: null,
          tagsOverride: [],
          overrideNote: null,
          overrideUpdatedAt: null,
        }),
      })
    );
  });

  it("DELETE overrides removes local uploaded covers", async () => {
    const fileName = "pool-1-anime-1-test.webp";
    const filePath = path.join(tempUploadDir, fileName);
    await writeFile(filePath, Buffer.from("image"));
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(
      poolAnime({
        coverUrlOverride: `/uploads/anime-covers/${fileName}`,
      })
    );
    mockedPoolAnime.update.mockResolvedValue(poolAnime());

    const response = await DELETE_OVERRIDES(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/overrides", {
        method: "DELETE",
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    await expect(stat(filePath)).rejects.toThrow();
    expect(response.status).toBe(200);
  });

  it("archiving a pool does not delete existing override data", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z"),
      })
    );

    const response = await DELETE_OVERRIDES(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/overrides", {
        method: "DELETE",
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(403);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });

  it("POST cover uploads jpg and updates coverUrlOverride", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime());
    mockedPoolAnime.update.mockResolvedValue(
      poolAnime({
        coverUrlOverride: "/uploads/anime-covers/saved-cover.jpg",
      }) as any
    );
    const formData = new FormData();
    formData.set("file", new File([Buffer.from([0xff, 0xd8, 0xff])], "cover.jpg", { type: "image/jpeg" }));

    const response = await POST_COVER(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/cover", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );
    const payload = await response.json();
    const files = await readdir(tempUploadDir);

    expect(response.status).toBe(200);
    expect(payload.data.coverUrl).toMatch(/^\/uploads\/anime-covers\/pool-1-anime-1-/);
    expect(payload.data.coverUrl).toMatch(/\.jpg$/);
    expect(files).toHaveLength(1);
    expect(mockedPoolAnime.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coverUrlOverride: payload.data.coverUrl,
          overrideUpdatedAt: expect.any(Date),
        }),
      })
    );
  });

  it("POST cover rejects non-image files", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime());
    const formData = new FormData();
    formData.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));

    const response = await POST_COVER(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/cover", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });

  it("POST cover rejects oversized files", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime());
    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cover.png", { type: "image/png" })
    );

    const response = await POST_COVER(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/cover", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(413);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });

  it("POST cover returns 404 when anime is not in the pool", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(pool());
    mockedPoolAnime.findUnique.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("file", new File([Buffer.from([0x89, 0x50])], "cover.png", { type: "image/png" }));

    const response = await POST_COVER(
      new Request("http://test.local/api/pools/pool-1/anime/missing/cover", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1", animeId: "missing" } }
    );

    expect(response.status).toBe(404);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });

  it("POST cover rejects archived pools", async () => {
    mockedCustomPool.findUnique.mockResolvedValue(
      pool({
        status: PoolStatus.ARCHIVED,
        deletedAt: new Date("2026-01-03T00:00:00.000Z"),
      })
    );
    const formData = new FormData();
    formData.set("file", new File([Buffer.from([0x89, 0x50])], "cover.png", { type: "image/png" }));

    const response = await POST_COVER(
      new Request("http://test.local/api/pools/pool-1/anime/anime-1/cover", {
        method: "POST",
        body: formData,
      }),
      { params: { poolId: "pool-1", animeId: "anime-1" } }
    );

    expect(response.status).toBe(409);
    expect(mockedPoolAnime.update).not.toHaveBeenCalled();
  });
});

