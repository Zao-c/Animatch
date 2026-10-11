import { beforeEach, describe, expect, it, vi } from "vitest";
import { bangumiRequest } from "../src/lib/bangumi";
import { fetchBangumiSubjects } from "../src/lib/import/bangumi-import-source";
import { validateQuickImportParams } from "../src/lib/import/quick-import-options";
vi.mock("../src/lib/bangumi", async (original) => ({ ...await original<object>(), bangumiRequest: vi.fn() }));
const response = (data: unknown) => ({ ok: true, statusCode: 200, json: async <T>() => data as T, text: async () => JSON.stringify(data) });
const subject = (id: number, year = 2026, platform = "TV") => ({ id, name: `Anime ${id}`, date: `${year}-04-01`, platform, tags: [{ name: "恋爱" }], rating: { rank: id } });
beforeEach(() => vi.clearAllMocks());
describe("batch import filter behavior", () => {
  it("validates bounds and requires visible inputs", () => {
    expect(() => validateQuickImportParams({ source: "BANGUMI", mode: "YEAR" })).toThrow("播出年份");
    expect(() => validateQuickImportParams({ source: "BANGUMI", mode: "TAG", year: NaN })).toThrow("年份");
    expect(() => validateQuickImportParams({ source: "BANGUMI", mode: "YEAR", year: 2026, limit: 501 })).toThrow("500");
    expect(validateQuickImportParams({ source: "BANGUMI", mode: "USER_COLLECTION", bangumiUserId: "friend" }).year).toBeUndefined();
  });
  it("fetches beyond 100 entries for an annual batch and sends a valid empty keyword", async () => {
    vi.mocked(bangumiRequest).mockImplementation(async (url) => {
      const u = new URL(String(url)), offset = Number(u.searchParams.get("offset")), limit = Number(u.searchParams.get("limit"));
      return response({ data: Array.from({ length: Math.min(limit, Math.max(0, 125 - offset)) }, (_, i) => subject(offset + i + 1)) });
    });
    const result = await fetchBangumiSubjects({ source: "BANGUMI", mode: "YEAR", year: 2026, limit: 500 });
    expect(result).toHaveLength(125);
    const body = JSON.parse(String(vi.mocked(bangumiRequest).mock.calls[0][1]?.body));
    expect(body).toMatchObject({ keyword: "", filter: { air_date: [">=2026-01-01", "<=2026-12-31"] } });
  });
  it("sends year to upstream TOP queries instead of filtering only all-time leaders", async () => {
    vi.mocked(bangumiRequest).mockResolvedValue(response({ data: [subject(1)] }));
    await fetchBangumiSubjects({ source: "BANGUMI", mode: "TOP", year: 2026, limit: 30 });
    expect(String(vi.mocked(bangumiRequest).mock.calls[0][0])).toContain("year=2026");
  });
  it("combines year, tag and format filters", async () => {
    vi.mocked(bangumiRequest).mockResolvedValue(response({ data: [subject(1), subject(2, 2025), subject(3, 2026, "剧场版")] }));
    const items = await fetchBangumiSubjects({ source: "BANGUMI", mode: "YEAR", year: 2026, tags: ["恋爱"], type: "TV" });
    expect(items.map((s) => s.bgmId)).toEqual([1]);
    const body = JSON.parse(String(vi.mocked(bangumiRequest).mock.calls[0][1]?.body));
    expect(body.filter).toMatchObject({ tag: ["恋爱"], air_date: [">=2026-01-01", "<=2026-12-31"] });
  });
  it("continues through old collection entries to find the requested year", async () => {
    vi.mocked(bangumiRequest).mockImplementation(async (url) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset"));
      return response({ data: offset === 0 ? Array.from({ length: 30 }, (_, i) => ({ subject: subject(i + 1, 2025) })) : [{ subject: subject(31) }] });
    });
    const items = await fetchBangumiSubjects({ source: "BANGUMI", mode: "USER_COLLECTION", bangumiUserId: "friend", year: 2026, limit: 20 });
    expect(items.map((s) => s.bgmId)).toEqual([31]);
  });
  it("never silently returns partial matches for combined collection tags", async () => {
    vi.mocked(bangumiRequest).mockResolvedValue(response({ data: [{ subject: subject(1) }] }));
    expect(await fetchBangumiSubjects({ source: "BANGUMI", mode: "USER_COLLECTION", bangumiUserId: "friend", tags: ["恋爱", "科幻"] })).toEqual([]);
  });
});
