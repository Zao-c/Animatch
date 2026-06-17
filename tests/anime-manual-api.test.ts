import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/anime/manual/route";
import { createManualAnime, toPublicAnime } from "../src/lib/anime-service";
import { getCurrentUser } from "../src/lib/auth-session";

vi.mock("../src/lib/auth-session", () => ({
  getCurrentUser: vi.fn(),
  requireCurrentUser: vi.fn()
}));

vi.mock("../src/lib/anime-service", () => ({
  createManualAnime: vi.fn(),
  toPublicAnime: vi.fn()
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedCreateManualAnime = vi.mocked(createManualAnime);
const mockedToPublicAnime = vi.mocked(toPublicAnime);

describe("POST /api/anime/manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 JSON for anonymous requests", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const response = await POST(
      new Request("http://test.local/api/anime/manual", {
        method: "POST",
        body: JSON.stringify({ title: "Test Anime" })
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      error: {
        message: "请先登录。"
      }
    });
    expect(mockedCreateManualAnime).not.toHaveBeenCalled();
  });

  it("returns 201 for logged-in users", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const mockAnime = {
      id: "anime-1",
      bgmId: null,
      title: "Test Anime",
      titleCn: null,
      titleJa: null,
      titleEn: null,
      summary: null,
      imageUrl: null,
      imageSmallUrl: null,
      imageMediumUrl: null,
      imageLargeUrl: null,
      thumbnailUrl: null,
      airDate: null,
      bangumiRank: null,
      bangumiScore: null,
      bangumiVotes: null,
      tags: [],
      aliases: [],
      year: null,
      season: null,
      animeType: "TV",
      episodes: null,
      status: null,
      studios: [],
      externalLinks: [],
      source: "MANUAL",
      sourceId: "manual-anime-1",
      rawJson: null,
      fetchedAt: null,
      imageStatus: "UNKNOWN",
      imageCheckedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };

    mockedCreateManualAnime.mockResolvedValue(mockAnime as any);
    mockedToPublicAnime.mockReturnValue({
      id: "anime-1",
      title: "Test Anime",
      source: "MANUAL"
    } as any);

    const response = await POST(
      new Request("http://test.local/api/anime/manual", {
        method: "POST",
        body: JSON.stringify({ title: "Test Anime" })
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      data: { id: "anime-1", title: "Test Anime" }
    });
    expect(mockedCreateManualAnime).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test Anime" })
    );
  });

  it("returns 400 when title is missing", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await POST(
      new Request("http://test.local/api/anime/manual", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      error: {
        message: "title is required"
      }
    });
    expect(mockedCreateManualAnime).not.toHaveBeenCalled();
  });

  it("returns 401 when body is missing entirely", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "user-1",
      username: "user-1",
      name: "User 1",
      image: null
    });

    const response = await POST(
      new Request("http://test.local/api/anime/manual", {
        method: "POST",
        body: "not-json"
      })
    );

    expect(response.status).toBe(400);
  });
});
