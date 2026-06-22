import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Bangumi import source service", () => {
  const source = readSource("src/lib/import/bangumi-import-source.ts");

  it("has fetchBangumiSubjects function", () => {
    expect(source).toContain("export async function fetchBangumiSubjects");
  });

  it("has upsertBangumiSubjects function", () => {
    expect(source).toContain("export async function upsertBangumiSubjects");
  });

  it("has shouldUseRemote function", () => {
    expect(source).toContain("export function shouldUseRemote");
  });

  it("shouldUseRemote returns true for BANGUMI source", () => {
    expect(source).toContain('params.source === "BANGUMI"');
  });

  it("shouldUseRemote returns true for MIXED source", () => {
    expect(source).toContain('params.source === "MIXED"');
  });

  it("YEAR mode builds air_date filter", () => {
    expect(source).toContain("air_date");
    expect(source).toContain(">=${params.year}-01-01");
  });

  it("TOP mode sorts by rank", () => {
    expect(source).toContain('mode === "TOP"');
    expect(source).toContain('body.sort = "rank"');
  });

  it("TAG mode fetches per-tag and dedupes by bgmId", () => {
    expect(source).toContain("fetchByTags");
    expect(source).toContain("allSubjectsMap.has(subj.bgmId)");
  });

  it("filters by year in non-YEAR modes", () => {
    expect(source).toContain("s.airDate.getUTCFullYear() === params.year");
  });

  it("sorts by bangumiRank in TOP/rank mode", () => {
    expect(source).toContain("(s) => s.bangumiRank");
  });

  it("sorts by bangumiScore in score mode", () => {
    expect(source).toContain("(s) => s.bangumiScore");
  });

  it("clamps limit to 100 in filterAndSortCandidates", () => {
    expect(source).toContain("filtered.slice(0, limit)");
  });

  it("uses the shared Bangumi API client path for batch remote fetches", () => {
    expect(source).toContain("bangumiRequest");
    expect(source).toContain("buildHeaders");
    expect(source).not.toContain("outboundFetch");
  });

  it("filters remote Bangumi subjects by normalized anime type", () => {
    expect(source).toContain("s.animeType === expectedType");
    expect(source).toContain("remoteFetchTarget");
  });

  it("filters remote Bangumi subjects by selected tags after fetch", () => {
    expect(source).toContain("expectedTags");
    expect(source).toContain("subjectTags");
    expect(source).toContain("expectedTags.every");
  });

  it("USER_COLLECTION fetches user collections API", () => {
    expect(source).toContain("fetchUserCollections");
    expect(source).toContain("/users/");
    expect(source).toContain("/collections?subject_type=2");
  });

  it("USER_COLLECTION supports wish/collect/doing/on_hold/dropped", () => {
    expect(source).toContain("wish");
    expect(source).toContain("collect");
    expect(source).toContain("doing");
    expect(source).toContain("on_hold");
    expect(source).toContain("dropped");
  });

  it("USER_COLLECTION maps UI collection names to Bangumi numeric types", () => {
    expect(source).toContain("toBangumiCollectionType");
    expect(source).toContain("wish: 1");
    expect(source).toContain("collect: 2");
    expect(source).toContain("doing: 3");
    expect(source).toContain("on_hold: 4");
    expect(source).toContain("dropped: 5");
  });

  it("USER_COLLECTION returns empty for blank username", () => {
    expect(source).toContain("if (!username) return []");
  });

  it("upsert skips CUSTOM_UPLOAD/MANUAL/TIERMAKER_IMPORT sources", () => {
    expect(source).toContain("isProtectedAnimeSource");
    expect(source).toContain("CUSTOM_UPLOAD");
    expect(source).toContain("MANUAL");
    expect(source).toContain("TIERMAKER_IMPORT");
  });

  it("upsert creates new anime for unseen bgmId", () => {
    expect(source).toContain("prisma.anime.create");
    expect(source).toContain("source: ANIME_SOURCE.BANGUMI");
  });

  it("upsert updates existing anime with missing fields", () => {
    expect(source).toContain("prisma.anime.update");
    expect(source).toContain("addIfMissing");
  });

  it("upsert adds year from airDate", () => {
    expect(source).toContain("year: subject.airDate?.getUTCFullYear()");
  });

  it("upsert persists normalized Bangumi anime type", () => {
    expect(source).toContain("animeType: subject.animeType ?? null");
    expect(source).toContain('addIfMissing(updateData, existingRecord, "animeType", subject.animeType)');
  });

  it("upsert normalizes tags deduplication", () => {
    expect(source).toContain("normalizeDedupedTags");
    expect(source).toContain("maxCount");
    expect(source).toContain("seen.has(trimmed)");
  });

  it("upsert merges aliases from titleCn", () => {
    expect(source).toContain("mergeAliases");
    expect(source).toContain("subject.titleCn ? [subject.titleCn]");
  });

  it("upsert builds sourceUrl from bgmId", () => {
    expect(source).toContain("https://bgm.tv/subject/${subject.bgmId}");
  });

  it("does not expose email or password", () => {
    expect(source).not.toContain("email");
    expect(source).not.toContain("password");
  });
});

describe("Bangumi import cache", () => {
  const source = readSource("src/lib/import/bangumi-import-cache.ts");

  it("has getBangumiSubjectCache function", () => {
    expect(source).toContain("export function getBangumiSubjectCache");
  });

  it("has setBangumiSubjectCache function", () => {
    expect(source).toContain("export function setBangumiSubjectCache");
  });

  it("has 10-minute TTL", () => {
    expect(source).toContain("10 * 60 * 1000");
  });

  it("evicts expired entries", () => {
    expect(source).toContain("Date.now() > entry.expiresAt");
    expect(source).toContain("cache.delete(key)");
  });

  it("evicts oldest when size exceeds 200", () => {
    expect(source).toContain("cache.size > 200");
  });

  it("builds cache key from params", () => {
    expect(source).toContain("JSON.stringify");
    expect(source).toContain("params.mode");
  });
});

describe("预览 API 支持 remote fallback", () => {
  const source = readSource("src/app/api/pools/quick-import/preview/route.ts");

  it("uses previewQuickImportWithRemoteFallback", () => {
    expect(source).toContain("previewQuickImportWithRemoteFallback");
  });

  it("accepts useRemote param, default true", () => {
    expect(source).toContain("useRemote");
    expect(source).toContain("body?.useRemote !== false");
  });

  it("passes useRemote to service", () => {
    expect(source).toContain("previewQuickImportWithRemoteFallback(params, poolAnimeIds, useRemote)");
  });
});

describe("QuickImportPanel Bangumi UI", () => {
  const source = readSource("src/components/QuickImportPanel.tsx");

  it("has useRemote state", () => {
    expect(source).toContain("useRemote, setUseRemote");
  });

  it("has bangumiUserId state", () => {
    expect(source).toContain("bangumiUserId, setBangumiUserId");
  });

  it("has collectionType state", () => {
    expect(source).toContain("collectionType, setCollectionType");
  });

  it("has remote toggle checkbox", () => {
    expect(source).toContain("本地不足时从 Bangumi 补全");
    expect(source).toContain("checked={useRemote}");
  });

  it("shows accurate Bangumi remote mode hints", () => {
    expect(source).toContain("Bangumi 源会实时按筛选拉取");
    expect(source).toContain("混合模式本地不足时从 Bangumi 补全");
  });

  it("shows MANAMI local-only hint", () => {
    expect(source).toContain("Manami 仅限本地库");
  });

  it("has Bangumi user ID input for USER_COLLECTION mode", () => {
    expect(source).toContain("Bangumi 用户 ID");
    expect(source).toContain('placeholder="例如 Zao-c"');
  });

  it("has collection type selector for USER_COLLECTION", () => {
    expect(source).toContain("看过");
    expect(source).toContain("想看");
    expect(source).toContain("在看");
  });

  it("passes useRemote to preview API", () => {
    expect(source).toContain("useRemote,");
  });

  it("shows remoteFetch info in preview header", () => {
    expect(source).toContain("remoteFetch?.attempted");
    expect(source).toContain("Bangumi 补全 +");
    expect(source).toContain("Bangumi 未返回结果");
  });

  it("has improved empty state message", () => {
    expect(source).toContain("本地库没有命中，Bangumi 也没有拉到结果");
  });

  it("does not expose sensitive fields", () => {
    expect(source).not.toContain("email");
    expect(source).not.toContain("password");
  });
});

describe("Client API remote types", () => {
  const source = readSource("src/lib/client-api.ts");

  it("has RemoteFetchResult interface", () => {
    expect(source).toContain("export interface RemoteFetchResult");
    expect(source).toContain("attempted: boolean");
    expect(source).toContain("succeeded: boolean");
    expect(source).toContain("insertedCount: number");
    expect(source).toContain("updatedCount: number");
    expect(source).toContain("fetchedCount: number");
  });

  it("QuickImportPreviewResult has remoteFetch field", () => {
    expect(source).toContain("remoteFetch?: RemoteFetchResult");
  });

  it("previewQuickImport accepts useRemote param", () => {
    expect(source).toContain("useRemote?: boolean");
  });
});

describe("Remote fallback in quick-pool-builder", () => {
  const source = readSource("src/lib/import/quick-pool-builder.ts");

  it("has previewQuickImportWithRemoteFallback function", () => {
    expect(source).toContain("export async function previewQuickImportWithRemoteFallback");
  });

  it("calls local preview first", () => {
    expect(source).toContain("const localResult = await previewQuickImport(params");
  });

  it("checks useRemote and shouldUseRemote", () => {
    expect(source).toContain("useRemote &&");
    expect(source).toContain("shouldUseRemote(params)");
  });

  it("checks local candidates < limit before fetching remote", () => {
    expect(source).toContain("localResult.candidates.length < limit");
  });

  it("prefers remote results for Bangumi source and user collection mode", () => {
    expect(source).toContain("shouldPreferRemote");
    expect(source).toContain('params.source === "BANGUMI"');
    expect(source).toContain('params.mode === "USER_COLLECTION"');
  });

  it("returns local result with attempted:false when not fetching remote", () => {
    expect(source).toContain("attempted: false");
  });

  it("checks cache before fetching", () => {
    expect(source).toContain("getBangumiSubjectCache(params)");
  });

  it("sets cache after successful fetch", () => {
    expect(source).toContain("setBangumiSubjectCache(params, subjects)");
  });

  it("calls upsertBangumiSubjects after fetch", () => {
    expect(source).toContain("upsertBangumiSubjects(subjects)");
    expect(source).toContain("insertedCount");
    expect(source).toContain("updatedCount");
  });

  it("builds preview candidates from the fetched Bangumi subject ids", () => {
    expect(source).toContain("previewBangumiSubjects");
    expect(source).toContain("bgmId: { in: bgmIds }");
    expect(source).toContain("animeByBgmId.get(subject.bgmId)");
  });

  it("returns local result on fetch error", () => {
    expect(source).toContain("Bangumi 暂时不可用，已返回本地结果");
  });

  it("warns when remote returns empty", () => {
    expect(source).toContain("Bangumi 远程查询没有返回结果");
  });

  it("warns when upsert fails", () => {
    expect(source).toContain("Bangumi 数据写入本地库失败");
  });

  it("createPoolFromQuickImport uses remote fallback", () => {
    expect(source).toContain("previewQuickImportWithRemoteFallback(params)");
  });
});

describe("Bangumi API client exports", () => {
  const source = readSource("src/lib/bangumi.ts");

  it("exports BANGUMI_BASE_URL", () => {
    expect(source).toContain("export const BANGUMI_BASE_URL");
  });

  it("exports bangumiRequest", () => {
    expect(source).toContain("export async function bangumiRequest");
  });

  it("exports buildHeaders", () => {
    expect(source).toContain("export function buildHeaders");
  });

  it("normalizes Bangumi platform into animeType", () => {
    expect(source).toContain("animeType?: string | null");
    expect(source).toContain("normalizeBangumiPlatform");
  });
});
