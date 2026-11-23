import { beforeEach, describe, expect, it, vi } from "vitest";
import { bangumiRequest } from "@/lib/bangumi";
import { prisma } from "@/lib/db";
import { GET as discover } from "@/app/api/anime/discover/route";
import { fetchBangumiSubjects } from "@/lib/import/bangumi-import-source";
import { validateQuickImportParams } from "@/lib/import/quick-import-options";
import { getBangumiSubjectCache, setBangumiSubjectCache, clearBangumiCache } from "@/lib/import/bangumi-import-cache";
import { validateDiscoveryYears } from "@/lib/anime-discovery";
import { getComparisonResultForShortcut } from "@/lib/match-shortcuts";

vi.mock("@/lib/bangumi", async (original) => ({ ...await original<object>(), bangumiRequest: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { anime: { findMany: vi.fn(), count: vi.fn() } } }));
const response = (data: unknown) => ({ ok: true, statusCode: 200, json: async <T>() => data as T, text: async () => JSON.stringify(data) });
const subject = (id: number, date: string, platform: string) => ({ id, name: `Anime ${id}`, date, platform, tags: [], rating: { rank: id } });

beforeEach(() => {
  vi.clearAllMocks(); clearBangumiCache();
  vi.mocked(prisma.anime.findMany).mockResolvedValue([]);
  vi.mocked(prisma.anime.count).mockResolvedValue(0);
});

describe("combined anime filters", () => {
  it("keeps only the selected month and accepts both WEB and ONA platform names", async () => {
    vi.mocked(bangumiRequest).mockResolvedValue(response({ data: [subject(1, "2026-04-01", "Web"), subject(2, "2026-04-30", "ONA"), subject(3, "2026-05-01", "WEB"), subject(4, "2026-04-05", "TV")] }));
    const result = await fetchBangumiSubjects({ source: "BANGUMI", mode: "YEAR", year: 2026, month: 4, type: "ONA" });
    expect(result.map((item) => item.bgmId)).toEqual([1, 2]);
    const body = JSON.parse(String(vi.mocked(bangumiRequest).mock.calls[0][1]?.body));
    expect(body.filter).toMatchObject({ air_date: [">=2026-04-01", "<2026-05-01"], meta_tags: ["WEB"] });
  });
  it.each([[2024, 2, "2024-02-01", "2024-03-01"], [2026, 12, "2026-12-01", "2027-01-01"]])("uses complete month boundaries for %i/%i", async (year, month, start, end) => {
    vi.mocked(bangumiRequest).mockResolvedValue(response({ data: [] }));
    await fetchBangumiSubjects({ source: "BANGUMI", mode: "YEAR", year, month });
    expect(JSON.parse(String(vi.mocked(bangumiRequest).mock.calls[0][1]?.body)).filter.air_date).toEqual([`>=${start}`, `<${end}`]);
  });
  it("passes month and format to TOP browsing", async () => {
    vi.mocked(bangumiRequest).mockResolvedValue(response({ data: [] }));
    await fetchBangumiSubjects({ source: "BANGUMI", mode: "TOP", year: 2026, month: 7, type: "TV" });
    const query = new URL(String(vi.mocked(bangumiRequest).mock.calls[0][0])).searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ year: "2026", month: "7", cat: "1" });
  });
  it("applies month boundaries and format aliases to local browsing", async () => {
    const result = await discover(new Request("http://localhost/api/anime/discover?yearFrom=2026&yearTo=2026&month=4&type=ONA"));
    expect(result.status).toBe(200);
    expect(vi.mocked(prisma.anime.findMany).mock.calls[0][0]?.where).toMatchObject({ deletedAt: null, animeType: { in: ["WEB", "ONA"] }, airDate: { gte: new Date("2026-04-01"), lt: new Date("2026-05-01") } });
  });
  it("does not reuse a cached April preview for July", () => {
    const params = { source: "BANGUMI", mode: "YEAR", year: 2026, month: 4 } as const;
    setBangumiSubjectCache(params, []);
    expect(getBangumiSubjectCache(params)).toEqual([]);
    expect(getBangumiSubjectCache({ ...params, month: 7 })).toBeNull();
  });
  it("rejects malformed month filters before querying the database", async () => {
    for (const month of ["0", "13", "x", "1.5"]) {
      expect((await discover(new Request(`http://localhost/api/anime/discover?yearFrom=2026&yearTo=2026&month=${month}`))).status).toBe(400);
    }
    expect(prisma.anime.findMany).not.toHaveBeenCalled();
    expect(() => validateQuickImportParams({ source: "BANGUMI", mode: "TOP", month: 4 })).toThrow("年份");
    expect(validateDiscoveryYears({ yearFrom: "2025", yearTo: "2026", month: "4" })).toContain("具体年份");
  });
});

describe("deliberate match keyboard choices", () => {
  it.each(["repeat", "isComposing", "ctrlKey", "metaKey", "altKey"])("ignores %s without casting a vote", (flag) => {
    expect(getComparisonResultForShortcut({ key: "ArrowLeft", target: null, [flag]: true })).toBeNull();
  });
  it("still accepts one deliberate arrow key press", () => {
    expect(getComparisonResultForShortcut({ key: "ArrowLeft", target: null })).toBe("LEFT_WIN");
  });
});
