import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Quick import service", () => {
  const source = readSource("src/lib/import/quick-pool-builder.ts");

  it("has previewQuickImport function", () => {
    expect(source).toContain("export async function previewQuickImport");
  });

  it("has createPoolFromQuickImport function", () => {
    expect(source).toContain("export async function createPoolFromQuickImport");
  });

  it("has addQuickImportToPool function", () => {
    expect(source).toContain("export async function addQuickImportToPool");
  });

  it("clamps limit to MAX_LIMIT=100", () => {
    expect(source).toContain("MAX_LIMIT = 100");
  });

  it("clampLimit enforces max 100", () => {
    expect(source).toContain("Math.max(1, Math.min(raw, MAX_LIMIT))");
  });

  it("deduplicates candidates by animeId", () => {
    expect(source).toContain("deduped = new Map");
    expect(source).toContain("deduped.has(item.id)");
  });

  it("supports YEAR mode", () => {
    expect(source).toContain('params.mode === "YEAR"');
    expect(source).toContain("where.year = params.year");
  });

  it("supports TAG mode", () => {
    expect(source).toContain('params.mode === "TAG"');
    expect(source).toContain("tags: { has: tag }");
  });

  it("supports TOP mode", () => {
    expect(source).toContain('params.mode === "TOP"');
  });

  it("supports USER_COLLECTION mode", () => {
    expect(source).toContain('params.mode === "USER_COLLECTION"');
    expect(source).toContain("用户收藏模式需要填写 Bangumi 用户 ID");
  });

  it("USER_COLLECTION does not pretend local search is a collection filter", () => {
    expect(source).toContain("用户收藏模式需要开启 Bangumi 远程拉取");
    expect(source).not.toContain("用户收藏导入功能暂未实现");
    expect(source).not.toContain("已切换为本地搜索模式");
  });

  it("resolves sources by source param", () => {
    expect(source).toContain("resolveSources(source");
  });

  it("BANGUMI only resolves to BANGUMI", () => {
    expect(source).toContain('source === "BANGUMI") return ["BANGUMI"]');
  });

  it("MANAMI only resolves to MANAMI", () => {
    expect(source).toContain('source === "MANAMI") return ["MANAMI"]');
  });

  it("MIXED resolves to BANGUMI+MANAMI", () => {
    expect(source).toContain('return ["BANGUMI", "MANAMI"]');
  });

  it("excludes custom upload / manual / tiermaker from results", () => {
    expect(source).toContain("GLOBAL_SEARCH_EXCLUDED_SOURCES");
  });

  it("reports missing covers as warning", () => {
    expect(source).toContain("缺少封面");
    expect(source).toContain("missingCovers");
  });

  it("sorts by rank in TOP mode", () => {
    expect(source).toContain('bangumiRank: "asc"');
  });

  it("sorts by score when sort=score", () => {
    expect(source).toContain('bangumiScore: "desc"');
  });

  it("createPool creates a customPool with creatorId", () => {
    expect(source).toContain("customPool.create");
    expect(source).toContain("creatorId: userId");
  });

  it("createPool respects selected preview candidates", () => {
    expect(source).toContain("selectedAnimeIds?: string[]");
    expect(source).toContain("filterCandidatesBySelectedIds");
    expect(source).toContain("selected.has(candidate.animeId)");
    expect(source).toContain("selectedCandidates.map((c) => c.animeId)");
  });

  it("createPool with PUB/PRIV visibility", () => {
    expect(source).toContain('visibility === "PUBLIC"');
    expect(source).toContain('visibility === "UNLISTED"');
  });

  it("adds anime to pool with position increment", () => {
    expect(source).toContain("getNextPoolAnimePosition");
    expect(source).toContain("withPoolAnimePositionTransaction");
    expect(source).toContain("nextPosition");
    expect(source).toContain("position: nextPosition++");
  });

  it("skips already existing anime in pool", () => {
    expect(source).toContain("existingIds.has(animeId)");
    expect(source).toContain("skippedCount++");
  });

  it("triggers cover prewarm on import", () => {
    expect(source).toContain("enqueuePoolAnimeCoversCache");
    expect(source).toContain("animesToCache");
    expect(source).toContain("getAnimeCoverUrl");
  });

  it("returns addedCount/skippedCount/failedCount", () => {
    expect(source).toContain("addedCount: number");
    expect(source).toContain("skippedCount: number");
    expect(source).toContain("failedCount: number");
  });

  it("has QUICK_IMPORT_PRESETS with 6 entries", () => {
    const presetsSource = readSource("src/lib/import/quick-import-presets.ts");
    expect(presetsSource).toContain("QUICK_IMPORT_PRESETS");
    expect(presetsSource).toContain("2026 TV 新番 Top 50");
    expect(presetsSource).toContain("2025 TV 新番 Top 50");
    expect(presetsSource).toContain("恋爱校园 Top 30");
    expect(presetsSource).toContain("异世界 Top 30");
    expect(presetsSource).toContain("热血战斗 Top 50");
    expect(presetsSource).toContain("Bangumi Top 100 TV");
  });

  it("only exposes public anime fields", () => {
    expect(source).not.toContain("email");
    expect(source).not.toContain("password");
  });
});

describe("Quick import API routes", () => {
  it("POST /api/pools/quick-import/preview requires user", () => {
    const source = readSource("src/app/api/pools/quick-import/preview/route.ts");
    expect(source).toContain("requireCurrentUser");
    expect(source).toContain("previewQuickImport");
  });

  it("preview validates source and mode", () => {
    const source = readSource("src/app/api/pools/quick-import/preview/route.ts");
    expect(source).toContain("source 和 mode 是必填字段");
    expect(source).toContain("validSources");
    expect(source).toContain("validModes");
  });

  it("preview can accept poolId for dedup", () => {
    const source = readSource("src/app/api/pools/quick-import/preview/route.ts");
    expect(source).toContain("body?.poolId");
    expect(source).toContain("poolAnimeIds");
  });

  it("POST /api/pools/quick-import/create requires user", () => {
    const source = readSource("src/app/api/pools/quick-import/create/route.ts");
    expect(source).toContain("requireCurrentUser");
    expect(source).toContain("createPoolFromQuickImport");
  });

  it("create validates poolName and params", () => {
    const source = readSource("src/app/api/pools/quick-import/create/route.ts");
    expect(source).toContain("poolName 和 params 是必填字段");
    expect(source).toContain("params.source");
  });

  it("create accepts selectedAnimeIds from preview", () => {
    const source = readSource("src/app/api/pools/quick-import/create/route.ts");
    expect(source).toContain("selectedAnimeIds?: string[]");
    expect(source).toContain("selectedAnimeIds: body.selectedAnimeIds");
  });

  it("POST /api/pools/[poolId]/quick-import requires canEditContent", () => {
    const source = readSource("src/app/api/pools/[poolId]/quick-import/route.ts");
    expect(source).toContain("canEditPoolContent");
    expect(source).toContain("requireCurrentUser");
  });

  it("add-to-pool rejects archived pool", () => {
    const source = readSource("src/app/api/pools/[poolId]/quick-import/route.ts");
    expect(source).toContain("pool.deletedAt");
    expect(source).toContain("番组不存在或已归档");
  });

  it("add-to-pool requires animeIds array", () => {
    const source = readSource("src/app/api/pools/[poolId]/quick-import/route.ts");
    expect(source).toContain("animeIds 不能为空");
  });
});

describe("QuickImportPanel UI", () => {
  const source = readSource("src/components/QuickImportPanel.tsx");

  it("has source selector (MIXED/BANGUMI/MANAMI)", () => {
    expect(source).toContain("混合");
    expect(source).toContain("Bangumi");
    expect(source).toContain("Manami");
  });

  it("has mode selector (YEAR/TAG/TOP/USER_COLLECTION)", () => {
    expect(source).toContain("年份新番");
    expect(source).toContain("标签筛选");
    expect(source).toContain("Top 榜");
    expect(source).toContain("用户收藏");
  });

  it("has type selector (ALL/TV/MOVIE/OVA)", () => {
    expect(source).toContain("type === t.key");
  });

  it("has limit buttons 20/30/50/100", () => {
    expect(source).toContain("LIMITS");
    expect(source).toContain("20");
    expect(source).toContain("100");
  });

  it("has preset buttons fill form", () => {
    expect(source).toContain("QUICK_IMPORT_PRESETS");
    expect(source).toContain("applyPreset");
  });

  it("preset fills source/mode/year/type/tags/limit/sort", () => {
    expect(source).toContain("setSource(p.source)");
    expect(source).toContain("setMode(p.mode)");
    expect(source).toContain("setYear");
    expect(source).toContain("setSelectedTags(p.tags)");
  });

  it("supports custom Bangumi tag input in quick import", () => {
    expect(source).toContain("customTagInput");
    expect(source).toContain("mergeTags(selectedTags, customTagInput)");
    expect(source).toContain("自定义 Bangumi 标签");
    expect(source).toContain("用逗号分隔");
  });

  it("accepts Bangumi profile URLs for user collection import", () => {
    expect(source).toContain("用户名或 https://bgm.tv/user/xxx");
  });

  it("has preview button", () => {
    expect(source).toContain("handlePreview");
    expect(source).toContain("预览");
  });

  it("preview shows candidate cards with AnimeCover", () => {
    expect(source).toContain("AnimeCover");
    expect(source).toContain("animeId={candidate.animeId}");
  });

  it("shows alreadyInPool badge", () => {
    expect(source).toContain("alreadyInPool");
    expect(source).toContain("已存在");
  });

  it("disabled alreadyInPool cards", () => {
    expect(source).toContain("disabled={candidate.alreadyInPool}");
  });

  it("has selectAll and deselectExisting buttons", () => {
    expect(source).toContain("selectAll");
    expect(source).toContain("取消已存在");
  });

  it("shows create pool form when no poolId", () => {
    expect(source).toContain("poolName");
    expect(source).toContain("创建番组");
  });

  it("create pool requires poolName", () => {
    expect(source).toContain("请输入番组名");
  });

  it("create pool sends selected preview candidates", () => {
    expect(source).toContain("selectedAnimeIds: Array.from(selectedIds)");
    expect(source).toContain("preview === null || previewParams === null");
    expect(source).toContain("params: previewParams");
  });

  it("adds to existing pool when poolId", () => {
    expect(source).toContain("addQuickImportToPool");
    expect(source).toContain("添加选中");
  });

  it("reports added/skipped counts", () => {
    expect(source).toContain("addedCount");
    expect(source).toContain("skippedCount");
  });

  it("does not expose sensitive fields", () => {
    expect(source).not.toContain("email");
    expect(source).not.toContain("password");
  });
});

describe("Quick import client API functions", () => {
  const source = readSource("src/lib/client-api.ts");

  it("has QuickImportCandidate interface", () => {
    expect(source).toContain("export interface QuickImportCandidate");
    expect(source).toContain("alreadyInPool");
  });

  it("has previewQuickImport function", () => {
    expect(source).toContain("export function previewQuickImport");
    expect(source).toContain("/api/pools/quick-import/preview");
  });

  it("has createPoolFromQuickImport function", () => {
    expect(source).toContain("export function createPoolFromQuickImport");
    expect(source).toContain("/api/pools/quick-import/create");
  });

  it("createPoolFromQuickImport can send selectedAnimeIds", () => {
    expect(source).toContain("selectedAnimeIds?: string[]");
  });

  it("has addQuickImportToPool function", () => {
    expect(source).toContain("export function addQuickImportToPool");
    expect(source).toContain("/api/pools/");
    expect(source).toContain("/quick-import");
  });

  it("has QuickImportPreviewResult interface", () => {
    expect(source).toContain("export interface QuickImportPreviewResult");
    expect(source).toContain("warnings: string[]");
  });

  it("has QuickImportCreateResult interface", () => {
    expect(source).toContain("export interface QuickImportCreateResult");
    expect(source).toContain("poolId: string");
  });

  it("has QuickImportAddResult interface", () => {
    expect(source).toContain("export interface QuickImportAddResult");
    expect(source).toContain("addedItems");
  });
});

describe("Quick import pages integration", () => {
  it("new pool page imports QuickImportPanel", () => {
    const source = readSource("src/app/pools/new/page.tsx");
    expect(source).toContain("QuickImportPanel");
  });

  it("pool detail page has quick import tab", () => {
    const source = readSource("src/app/pools/[poolId]/page.tsx");
    expect(source).toContain("批量添加作品");
    expect(source).toContain("activeTab === \"quick\"");
  });

  it("pool detail page QuickImportPanel uses poolId", () => {
    const source = readSource("src/app/pools/[poolId]/page.tsx");
    expect(source).toContain("poolId={params.poolId}");
  });
});
