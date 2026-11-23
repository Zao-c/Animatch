import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { POST } from "../src/app/api/pools/[poolId]/anime/tiermaker-import/route";
import { ANIME_SOURCE } from "../src/lib/anime-source";
import {
  makeTierMakerImportBgmId,
  normalizeTierMakerUrl,
  importTierMakerFromUrl
} from "../src/lib/tiermaker-import";
import {
  validateTierMakerTemplateUrl,
  parseTierMakerTemplate
} from "../src/lib/tiermaker-fetch";
import { prisma } from "../src/lib/db";
import { AppError } from "../src/lib/app-error";
import {
  formatTierMakerAutoParseError,
  parseTierMakerUrlList,
  TIERMAKER_AUTO_PARSE_LIMITED_MESSAGE,
  TIERMAKER_IMPORT_ASSISTANT_SCRIPT,
  TIERMAKER_URL_LIST_SOURCE,
  TIERMAKER_URL_LIST_TEMPLATE_NAME
} from "../src/lib/tiermaker-url-list";

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

const { requireCurrentUser } = await import("../src/lib/auth-session");
const mockedRequireCurrentUser = vi.mocked(requireCurrentUser);

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

const urlListRequestBody = {
  templateUrl: TIERMAKER_URL_LIST_SOURCE,
  templateName: TIERMAKER_URL_LIST_TEMPLATE_NAME,
  items: [
    {
      title: "URL List A",
      imageUrl: "https://tiermaker.com/images/item-a.png",
      index: 0
    },
    {
      title: "URL List B",
      imageUrl: "https://tiermaker.com/images/item-b.png",
      index: 1
    }
  ]
};

const tiermakerFixtureHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Tier List Maker - Genshin Characters 2026</title>
  <meta property="og:title" content="Genshin Characters 2026" />
</head>
<body>
  <h1>TierMaker Template</h1>
  <div class="template-items">
    <div class="item">
      <img src="https://cdn.tiermaker.com/item/render/1.png" alt="Zhongli" width="200" height="300" />
      <span>Zhongli</span>
    </div>
    <div class="item">
      <img src="https://cdn.tiermaker.com/item/render/2.png" alt="Raiden" width="200" height="300" />
    </div>
    <div class="item">
      <img src="https://cdn.tiermaker.com/item/render/3.png" alt="Nahida" width="200" height="300" />
    </div>
    <img src="https://cdn.tiermaker.com/logo-small.png" class="logo" width="30" height="30" alt="logo" />
    <img src="https://cdn.tiermaker.com/icon/avatar.png" class="avatar" width="16" height="16" />
  </div>
</body>
</html>`;

describe("TierMaker URL validation", () => {
  it("accepts valid https://tiermaker.com/create/... URL", () => {
    const result = validateTierMakerTemplateUrl("https://tiermaker.com/create/genshin-impact-13-792389");
    expect(result).toBe("https://tiermaker.com/create/genshin-impact-13-792389");
  });

  it("accepts www.tiermaker.com", () => {
    const result = validateTierMakerTemplateUrl("https://www.tiermaker.com/create/template-name");
    expect(result).toBe("https://www.tiermaker.com/create/template-name");
  });

  it("rejects http URLs", () => {
    expect(() =>
      validateTierMakerTemplateUrl("http://tiermaker.com/create/template")
    ).toThrow("Only HTTPS URLs are allowed");
  });

  it("rejects non-TierMaker host", () => {
    expect(() =>
      validateTierMakerTemplateUrl("https://example.com/create/template")
    ).toThrow("must point to tiermaker.com");
  });

  it("rejects URLs not starting with /create/", () => {
    expect(() =>
      validateTierMakerTemplateUrl("https://tiermaker.com/template/123")
    ).toThrow("must be a TierMaker template");
  });

  it("rejects javascript: protocol", () => {
    expect(() =>
      validateTierMakerTemplateUrl("javascript:alert(1)")
    ).toThrow("URL protocol is not allowed");
  });

  it("rejects data: protocol", () => {
    expect(() =>
      validateTierMakerTemplateUrl("data:text/html,hello")
    ).toThrow("URL protocol is not allowed");
  });

  it("rejects file: protocol", () => {
    expect(() =>
      validateTierMakerTemplateUrl("file:///etc/passwd")
    ).toThrow("URL protocol is not allowed");
  });

  it("rejects localhost", () => {
    expect(() =>
      validateTierMakerTemplateUrl("https://localhost/create/template")
    ).toThrow("Blocked hostname");
  });

  it("rejects private IP 127.0.0.1", () => {
    expect(() =>
      validateTierMakerTemplateUrl("https://127.0.0.1/create/template")
    ).toThrow("Blocked hostname");
  });

  it("rejects private IP 192.168.1.1", () => {
    expect(() =>
      validateTierMakerTemplateUrl("https://192.168.1.1/create/template")
    ).toThrow("Private IP addresses are not allowed");
  });

  it("normalizes URL by removing hash and sorting params", () => {
    const result = validateTierMakerTemplateUrl("https://tiermaker.com/create/template?b=2&a=1#section");
    expect(result).toBe("https://tiermaker.com/create/template?a=1&b=2");
  });

  it("rejects empty URL", () => {
    expect(() =>
      validateTierMakerTemplateUrl("")
    ).toThrow("URL is required");
  });
});

describe("TierMaker HTML parser", () => {
  it("extracts title from og:title meta tag", () => {
    const result = parseTierMakerTemplate(tiermakerFixtureHtml, "https://tiermaker.com/create/test");
    expect(result.title).toBe("Genshin Characters 2026");
  });

  it("extracts images from HTML", () => {
    const result = parseTierMakerTemplate(tiermakerFixtureHtml, "https://tiermaker.com/create/test");
    expect(result.items.length).toBe(3);
    expect(result.items[0].title).toBe("Zhongli");
    expect(result.items[1].title).toBe("Raiden");
    expect(result.items[2].title).toBe("Nahida");
  });

  it("extracts image URLs as absolute", () => {
    const result = parseTierMakerTemplate(tiermakerFixtureHtml, "https://tiermaker.com/create/test");
    for (const item of result.items) {
      expect(item.imageUrl).toMatch(/^https?:\/\//);
    }
  });

  it("deduplicates images by URL", () => {
    const html = `
      <html><body>
      <img src="https://cdn.tiermaker.com/a.png" alt="A" width="200" height="300" />
      <img src="https://cdn.tiermaker.com/a.png" alt="A dupe" width="200" height="300" />
      <img src="https://cdn.tiermaker.com/b.png" alt="B" width="200" height="300" />
      </body></html>`;
    const result = parseTierMakerTemplate(html, "https://tiermaker.com/create/test");
    expect(result.items.length).toBe(2);
  });

  it("filters out logo/small images", () => {
    const result = parseTierMakerTemplate(tiermakerFixtureHtml, "https://tiermaker.com/create/test");
    const titles = result.items.map((item) => item.title);
    expect(titles).not.toContain("logo");
  });

  it("uses alt text as item title", () => {
    const result = parseTierMakerTemplate(tiermakerFixtureHtml, "https://tiermaker.com/create/test");
    expect(result.items[0].title).toBe("Zhongli");
  });

  it("returns sourceIndex for each item", () => {
    const result = parseTierMakerTemplate(tiermakerFixtureHtml, "https://tiermaker.com/create/test");
    expect(result.items[0].sourceIndex).toBe(0);
    expect(result.items[1].sourceIndex).toBe(1);
    expect(result.items[2].sourceIndex).toBe(2);
  });

  it("throws when no images found", () => {
    expect(() =>
      parseTierMakerTemplate("<html><body>No images here</body></html>", "https://tiermaker.com/create/test")
    ).toThrow("No images found");
  });
});

describe("TierMaker import assistant", () => {
  it("copies a script that reads document.images", () => {
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).toContain("document.images");
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).toContain("navigator.clipboard.writeText");
  });

  it("does not fetch AniMatch APIs or read cookies", () => {
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).not.toMatch(/fetch\s*\(/);
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).not.toContain("/api/");
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).not.toContain("document.cookie");
    expect(TIERMAKER_IMPORT_ASSISTANT_SCRIPT).not.toContain("cookie");
  });

  it("maps automatic preview 403 and 502 errors to a friendly helper message", () => {
    expect(formatTierMakerAutoParseError("TierMaker returned status 403")).toBe(
      TIERMAKER_AUTO_PARSE_LIMITED_MESSAGE
    );
    expect(formatTierMakerAutoParseError("TierMaker returned status 502")).toBe(
      TIERMAKER_AUTO_PARSE_LIMITED_MESSAGE
    );
  });
});

describe("TierMaker URL list parser", () => {
  it("supports one URL per line", () => {
    const items = parseTierMakerUrlList("https://tiermaker.com/images/item-a.png");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "item a",
      imageUrl: "https://tiermaker.com/images/item-a.png",
      sourceUrl: TIERMAKER_URL_LIST_SOURCE,
      sourceIndex: 0
    });
  });

  it("supports title pipe URL lines", () => {
    const items = parseTierMakerUrlList("Custom Title | https://tiermaker.com/images/item-a.png");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Custom Title",
      imageUrl: "https://tiermaker.com/images/item-a.png"
    });
  });

  it("deduplicates URL list imports by normalized image URL", () => {
    const items = parseTierMakerUrlList(`
https://tiermaker.com/images/item-a.png#top
Duplicate | https://tiermaker.com/images/item-a.png
https://tiermaker.com/images/item-b.png
`);

    expect(items.map((item) => item.imageUrl)).toEqual([
      "https://tiermaker.com/images/item-a.png#top",
      "https://tiermaker.com/images/item-b.png"
    ]);
  });

  it("limits URL list imports to 200 items", () => {
    const input = Array.from(
      { length: 205 },
      (_, index) => `https://tiermaker.com/images/item-${index}.png`
    ).join("\n");

    expect(parseTierMakerUrlList(input)).toHaveLength(200);
  });
});

describe("TierMaker import API permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireCurrentUser.mockResolvedValue({ id: "user-1", username: "user-1", name: "User 1", image: null });
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

  it("returns 401 when not logged in", async () => {
    mockedRequireCurrentUser.mockRejectedValueOnce(new AppError("Authentication required", 401, "AUTH_REQUIRED"));

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(requestBody)
      }),
      { params: { poolId: "pool-1" } }
    );
    expect(response.status).toBe(401);
  });

  it("rejects userB importing userA pool", async () => {
    mockedRequireCurrentUser.mockResolvedValue({ id: "user-2", username: "user-2", name: "User 2", image: null });

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(requestBody)
      }),
      { params: { poolId: "pool-1" } }
    );
    expect(response.status).toBe(403);
  });
});

describe("TierMaker import source type (existing)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireCurrentUser.mockResolvedValue({ id: "user-1", username: "user-1", name: "User 1", image: null });
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

  it("imports URL list items with TIERMAKER_IMPORT source type", async () => {
    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(urlListRequestBody)
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.importedCount).toBe(2);
    expect(mockedAnime.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: ANIME_SOURCE.TIERMAKER_IMPORT,
          rawJson: expect.objectContaining({
            sourceType: ANIME_SOURCE.TIERMAKER_IMPORT,
            sourceUrl: TIERMAKER_URL_LIST_SOURCE
          })
        })
      })
    );
  });

  it("skips repeated URL list imports", async () => {
    await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(urlListRequestBody)
      }),
      { params: { poolId: "pool-1" } }
    );

    mockedPoolAnime.findUnique.mockResolvedValue(poolAnime() as any);

    const response = await POST(
      new Request("http://test.local/api/pools/pool-1/anime/tiermaker-import", {
        method: "POST",
        body: JSON.stringify(urlListRequestBody)
      }),
      { params: { poolId: "pool-1" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.importedCount).toBe(0);
    expect(payload.data.skippedCount).toBe(2);
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

    expect(response.status).toBe(403);
    expect(mockedAnime.upsert).not.toHaveBeenCalled();
    expect(mockedPoolAnime.create).not.toHaveBeenCalled();
  });
});
