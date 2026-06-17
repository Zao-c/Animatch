import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Bangumi import tab UI", () => {
  const detailSource = readFileSync("src/app/pools/[poolId]/page.tsx", "utf8");
  const clientApiSource = readFileSync("src/lib/client-api.ts", "utf8");

  it("shows a dedicated Bangumi search tab", () => {
    expect(detailSource).toContain('{ key: "bangumi", label: "Bangumi 搜索" }');
    expect(detailSource).toContain("从 Bangumi 搜索公开条目并添加。");
    expect(detailSource).toContain("输入 Bangumi 关键词");
  });

  it("submits Bangumi searches through the dedicated endpoint", () => {
    expect(detailSource).toContain("function handleBangumiSearch");
    expect(detailSource).toContain("const result = await searchBangumiAnime(bangumiKeyword.trim(), 20)");
    expect(clientApiSource).toContain("export function searchBangumiAnime");
    expect(clientApiSource).toContain("/api/anime/bangumi/search?");
  });

  it("renders Bangumi results and imports the selected subject through the existing pool import API", () => {
    expect(detailSource).toContain("function BangumiResultCard");
    expect(detailSource).toContain("Bangumi ID ${item.bangumiId}");
    expect(detailSource).toContain("添加到当前番组");
    expect(detailSource).toContain("handleAddBangumiResult(item)");
    expect(detailSource).toContain("bulkImportAnimeToPool(params.poolId, String(item.bangumiId))");
    expect(detailSource).toContain("await refreshPool()");
  });

  it("shows success, failure, and empty-result states", () => {
    expect(detailSource).toContain("没有找到匹配条目。");
    expect(detailSource).toContain("搜索失败，请稍后重试。");
    expect(detailSource).toContain("已加入：${displayTitle}");
    expect(detailSource).toContain("已在番组中：${displayTitle}");
  });

  it("keeps the Bangumi tab wrapped for a 390px viewport", () => {
    expect(detailSource).toContain("grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]");
    expect(detailSource).toContain("anime-field min-w-0 flex-1");
    expect(detailSource).toContain("flex w-full min-w-0 gap-3");
    expect(detailSource).toContain("line-clamp-2 break-words");
    expect(detailSource).toContain("flex flex-wrap items-center gap-2");
  });
});
