import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../src/app/api/anime/discover/route";
import { prisma } from "../src/lib/db";

vi.mock("../src/lib/db", () => ({
  prisma: {
    anime: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const mockedAnime = vi.mocked(prisma.anime);

describe("anime discover API tag search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAnime.findMany.mockResolvedValue([]);
    mockedAnime.count.mockResolvedValue(0);
  });

  it("maps Chinese tag labels to canonical English tags", async () => {
    await GET(new Request("http://test.local/api/anime/discover?tag=恋爱"));

    expect(lastWhere().AND).toEqual(
      expect.arrayContaining([expect.objectContaining({ tags: { has: "romance" } })])
    );
  });

  it("maps Chinese aliases to canonical English tags", async () => {
    await GET(new Request("http://test.local/api/anime/discover?tag=爱情"));

    expect(lastWhere().AND).toEqual(
      expect.arrayContaining([expect.objectContaining({ tags: { has: "romance" } })])
    );
  });

  it("uses AND semantics for multiple selected tags", async () => {
    await GET(new Request("http://test.local/api/anime/discover?tags=恋爱,校园"));

    expect(lastWhere().AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tags: { has: "romance" } }),
        expect.objectContaining({ tags: { has: "school" } }),
      ])
    );
  });

  it("combines selected tags and query terms", async () => {
    await GET(new Request("http://test.local/api/anime/discover?tags=恋爱,校园&q=京都"));

    const andConditions = lastWhere().AND as unknown[];
    expect(andConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tags: { has: "romance" } }),
        expect.objectContaining({ tags: { has: "school" } }),
      ])
    );
    expect(JSON.stringify(andConditions)).toContain("京都");
  });

  it("normalizes tag case, spaces, and hyphens", async () => {
    await GET(new Request("http://test.local/api/anime/discover?tag=Slice-Of-Life"));

    expect(lastWhere().AND).toEqual(
      expect.arrayContaining([expect.objectContaining({ tags: { has: "slice of life" } })])
    );
  });

  it("excludes user-generated sources from global discover", async () => {
    await GET(new Request("http://test.local/api/anime/discover?limit=5"));

    expect(lastWhere().source).toEqual({
      notIn: expect.arrayContaining(["CUSTOM_UPLOAD", "MANUAL", "TIERMAKER_IMPORT"]),
    });
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

function lastWhere() {
  const call = mockedAnime.findMany.mock.calls.at(-1);
  if (call === undefined) {
    throw new Error("Expected prisma.anime.findMany to be called");
  }
  const args = call[0];
  if (args === undefined) {
    throw new Error("Expected prisma.anime.findMany arguments");
  }
  return args.where ?? {};
}
