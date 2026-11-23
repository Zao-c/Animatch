import { beforeEach, describe, expect, it, vi } from "vitest";
import { bangumiRequest } from "../src/lib/bangumi";
import { getAwardCredits, getAwardReference, normalizeReferenceCard, referenceId, referenceKind, searchAwardReferences } from "../src/lib/award-reference-service";
vi.mock("../src/lib/bangumi", () => ({ BANGUMI_BASE_URL: "https://api.bgm.tv/v0", buildHeaders: () => ({}), bangumiRequest: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
const response = (data: unknown) => ({ ok: true, statusCode: 200, json: async <T>() => data as T, text: async () => JSON.stringify(data) });
describe("award reference discovery", () => {
  it("retains Chinese names and alternate spellings without rendering source markup", () => {
    expect(normalizeReferenceCard({ id: 12, name: "Original", summary: "[b]text[/b]", infobox: [{ key: "简体中文名", value: "中文名" }, { key: "别名", value: [{ k: "别名", v: "另一个名字" }] }] }, "person"))
      .toMatchObject({ title: "中文名", subtitle: "Original", aliases: ["另一个名字"], summary: "[b]text[/b]" });
  });
  it("bounds references and sends only defined endpoints", async () => {
    expect(() => referenceKind("../../admin")).toThrow();
    expect(() => referenceId("0")).toThrow();
    vi.mocked(bangumiRequest).mockResolvedValue(response({ data: [{ id: 701, name: "作品" }] }));
    const items = await searchAwardReferences("搜索验证", "subject");
    expect(items[0].reference).toEqual({ kind: "subject", id: 701 });
    expect(bangumiRequest).toHaveBeenCalledWith("https://api.bgm.tv/v0/search/subjects?limit=8&offset=0", expect.objectContaining({ body: JSON.stringify({ keyword: "搜索验证", filter: { type: [2] } }) }));
  });
  it("coalesces repeated requests and combines multiple staff roles", async () => {
    vi.mocked(bangumiRequest).mockResolvedValue(response([{ id: 702, name: "导演", relation: "监督" }, { id: 702, name: "导演", relation: "分镜" }]));
    const [a, b] = await Promise.all([getAwardCredits(8001, "person"), getAwardCredits(8001, "person")]);
    expect(a).toEqual(b); expect(a).toHaveLength(1); expect(a[0].role).toBe("监督 / 分镜");
    expect(bangumiRequest).toHaveBeenCalledTimes(1);
  });
  it("shows actual related anime and staff roles, and marks a failed career lookup explicitly", async () => {
    vi.mocked(bangumiRequest).mockResolvedValueOnce(response({ id: 9001, name: "人物", summary: "人物简介" }))
      .mockResolvedValueOnce(response([{ id: 100, type: 2, name: "Animation", name_cn: "熟悉的动画", staff: "监督" }, { id: 101, type: 3, name: "音乐" }]));
    const detail = await getAwardReference("person", 9001);
    expect(detail.works).toEqual([{ id: 100, title: "熟悉的动画", role: "监督" }]);
    vi.mocked(bangumiRequest).mockResolvedValueOnce(response({ id: 9002, name: "另一个人物" })).mockRejectedValueOnce(new Error("timeout"));
    expect((await getAwardReference("person", 9002)).worksUnavailable).toBe(true);
  });
});
