import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ANIME_SOURCE } from "@/lib/anime-source";
import { cacheAnimeCoversToCosBackground } from "@/lib/server/cos-cover-cache";
import {
  BANGUMI_BASE_URL,
  bangumiRequest,
  buildHeaders,
  getBangumiSubject,
  normalizeBangumiSubject,
  type NormalizedBangumiSubject,
} from "@/lib/bangumi";
import {
  expandTagQuery,
  matchTagAliases,
  normalizeTagKey
} from "@/lib/anime-tag-dictionary";
import type { QuickImportParams } from "./quick-pool-builder";
import { MAX_QUICK_IMPORT } from "./quick-import-options";

export interface RemoteFetchResult {
  attempted: boolean;
  succeeded: boolean;
  insertedCount: number;
  updatedCount: number;
  fetchedCount: number;
  source: "BANGUMI" | null;
  incomplete?: boolean;
}

export interface RemoteFetchMeta {
  remoteFetch: RemoteFetchResult;
}

type ImportSubjects = NormalizedBangumiSubject[] & { incomplete?: boolean };
export function isIncompleteBangumiBatch(subjects: NormalizedBangumiSubject[]): boolean {
  return (subjects as ImportSubjects).incomplete === true;
}
async function requestImportPage(url: string, init: Parameters<typeof bangumiRequest>[1]) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await bangumiRequest(url, init);
      if (response.ok || (response.statusCode !== 429 && response.statusCode < 500)) return response;
      if (attempt >= 2) throw new Error(`Bangumi HTTP ${response.statusCode}`);
    } catch (error) { if (attempt >= 2) throw error; }
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 400));
  }
}

function isProtectedAnimeSource(source: string): boolean {
  return source === ANIME_SOURCE.CUSTOM_UPLOAD || source === ANIME_SOURCE.MANUAL || source === ANIME_SOURCE.TIERMAKER_IMPORT;
}

export function shouldUseRemote(params: QuickImportParams): boolean {
  return params.source === "BANGUMI" || params.source === "MIXED" || params.mode === "USER_COLLECTION";
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || limit === null) return 50;
  return Math.max(1, Math.min(limit, MAX_QUICK_IMPORT));
}

function remoteFetchTarget(params: QuickImportParams, limit: number): number {
  if (params.mode === "TAG" && params.tags && params.tags.length > 1) {
    return Math.min(1000, Math.max(limit, limit * (params.tags.length + 1)));
  }
  if (params.type && params.type !== "ALL") {
    return Math.min(1000, Math.max(limit, limit * 3));
  }
  return limit;
}

function compareByField<T>(a: T, b: T, getter: (item: T) => number | null | undefined, preferLarger = false): number {
  const va = getter(a) ?? (preferLarger ? -Infinity : Infinity);
  const vb = getter(b) ?? (preferLarger ? -Infinity : Infinity);
  return preferLarger ? vb - va : va - vb;
}

export async function fetchBangumiSubjects(
  params: QuickImportParams
): Promise<NormalizedBangumiSubject[]> {
  const limit = clampLimit(params.limit);

  if (params.mode === "USER_COLLECTION") {
    return fetchUserCollections(params);
  }
  if (params.tags && params.tags.length >= 1) {
    return fetchByTags(params);
  }
  if (params.mode === "TOP") {
    return fetchTopSubjects(params, limit);
  }

  return fetchBySearch(params, limit);
}

async function fetchTopSubjects(
  params: QuickImportParams,
  limit: number
): Promise<NormalizedBangumiSubject[]> {
  const allSubjects: ImportSubjects = [];
  let offset = 0;
  const fetchTarget = remoteFetchTarget(params, limit);
  const maxPages = Math.ceil(fetchTarget / 20);

  for (let page = 0; page < maxPages; page++) {
    const pageLimit = Math.min(20, fetchTarget - allSubjects.length);
    if (pageLimit <= 0) break;

    try {
      const category = ({ TV: 1, OVA: 2, MOVIE: 3, WEB: 5 } as Record<string, number>)[params.type ?? ""];
      const url = `${BANGUMI_BASE_URL}/subjects?type=2&sort=rank&limit=${pageLimit}&offset=${offset}${params.year ? `&year=${params.year}` : ""}${category ? `&cat=${category}` : ""}`;
      const response = await requestImportPage(url, {
        method: "GET",
        headers: buildHeaders()
      });

      if (!response.ok) throw new Error(`Bangumi HTTP ${response.statusCode}`);

      const payload = await response.json<{ data?: unknown[] }>();
      const rawItems = Array.isArray(payload.data) ? payload.data : [];
      for (const item of rawItems) {
        try {
          allSubjects.push(normalizeBangumiSubject(item));
        } catch {
          continue;
        }
      }

      if (rawItems.length < pageLimit) break;
      if (filterAndSortCandidates(allSubjects, params).length >= limit) break;
      offset += pageLimit;
    } catch {
      allSubjects.incomplete = true;
      break;
    }
  }

  return filterAndSortCandidates(allSubjects, params);
}

async function fetchBySearch(
  params: QuickImportParams,
  limit: number
): Promise<NormalizedBangumiSubject[]> {
  const allSubjects: ImportSubjects = [];
  let offset = 0;
  const fetchTarget = remoteFetchTarget(params, limit);
  const maxPages = Math.ceil(fetchTarget / 20);

  for (let page = 0; page < maxPages; page++) {
    const pageLimit = Math.min(20, fetchTarget - allSubjects.length);
    if (pageLimit <= 0) break;

    const body = buildSearchBody(params, params.mode);
    const url = `${BANGUMI_BASE_URL}/search/subjects?limit=${pageLimit}&offset=${offset}`;
    try {
      const response = await requestImportPage(url, {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error(`Bangumi HTTP ${response.statusCode}`);

      const payload = await response.json<{ data?: unknown[] }>();
      const rawItems = Array.isArray(payload.data) ? payload.data : [];
      for (const item of rawItems) {
        try {
          allSubjects.push(normalizeBangumiSubject(item));
        } catch {
          continue;
        }
      }

      if (rawItems.length < pageLimit) break;
      if (filterAndSortCandidates(allSubjects, params).length >= limit) break;
      offset += pageLimit;
    } catch {
      allSubjects.incomplete = true;
      break;
    }
  }

  return filterAndSortCandidates(allSubjects, params);
}

function buildSearchBody(
  params: QuickImportParams,
  mode: string
): Record<string, unknown> {
  const filter: Record<string, unknown> = { type: [2] };

  if (params.year) {
    filter.air_date = [`>=${params.year}-01-01`, `<=${params.year}-12-31`];
  }
  const platformTag = ({ TV: "TV", MOVIE: "剧场版", OVA: "OVA", WEB: "WEB" } as Record<string, string>)[params.type ?? ""];
  if (platformTag) filter.meta_tags = [platformTag];

  if (mode === "TAG" && params.tags && params.tags.length === 1) {
    filter.tag = params.tags;
  }

  const body: Record<string, unknown> = { keyword: "", filter };

  if (mode === "TOP") {
    body.sort = "rank";
  } else if (params.sort === "rank") {
    body.sort = "rank";
  } else if (params.sort === "score") {
    body.sort = "score";
  } else if (params.sort === "year") {
    body.sort = "rank";
  } else {
    body.sort = "rank";
  }

  return body;
}

async function fetchByTags(
  params: QuickImportParams
): Promise<NormalizedBangumiSubject[]> {
  const tags = params.tags!;
  const limit = clampLimit(params.limit);
  const fetchTarget = remoteFetchTarget(params, limit);
  const allSubjectsMap = new Map<number, NormalizedBangumiSubject>();
  const tagsToQuery = tags.slice(0, 5);

  let requests = 0, incomplete = false;
  for (const tag of tagsToQuery) {
    for (const queryTag of getBangumiTagQueryVariants(tag).slice(0, 4)) {
      if (tagsToQuery.length === 1 && allSubjectsMap.size >= fetchTarget) break;
      for (let offset = 0; offset < fetchTarget && requests < 50; offset += 20) {
        requests++;
        try {
          const url = `${BANGUMI_BASE_URL}/search/subjects?limit=20&offset=${offset}`;
          const body = buildSearchBody({ ...params, tags: [queryTag], mode: "TAG" }, "TAG");
          const response = await requestImportPage(url, { method: "POST", headers: buildHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
          if (!response.ok) throw new Error(`Bangumi HTTP ${response.statusCode}`);
          const payload = await response.json<{ data?: unknown[] }>();
          const rawItems = Array.isArray(payload.data) ? payload.data : [];
          for (const item of rawItems) {
            try {
              const subj = withQueryMatchedTags(normalizeBangumiSubject(item), tag, queryTag);
              if (!allSubjectsMap.has(subj.bgmId)) allSubjectsMap.set(subj.bgmId, subj);
              else {
                const existing = allSubjectsMap.get(subj.bgmId)!;
                allSubjectsMap.set(subj.bgmId, { ...existing, tags: [...new Set([...existing.tags, ...subj.tags])] });
              }
            } catch { continue; }
          }
          const filtered = filterAndSortCandidates(Array.from(allSubjectsMap.values()), params);
          if (filtered.length >= limit) return Object.assign(filtered, { incomplete });
          if (rawItems.length < 20) break;
        } catch { incomplete = true; break; }
      }
    }
  }

  const subjects = Object.assign(Array.from(allSubjectsMap.values()), { incomplete: incomplete || requests >= 50 });
  return filterAndSortCandidates(subjects, params);
}

function withQueryMatchedTags(
  subject: NormalizedBangumiSubject,
  selectedTag: string,
  queryTag: string
): NormalizedBangumiSubject {
  const tags = [...subject.tags];
  const seen = new Set(tags.map((tag) => normalizeTagKey(tag)));

  for (const tag of [selectedTag, queryTag]) {
    const normalized = normalizeTagKey(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(tag);
  }

  return tags.length === subject.tags.length ? subject : { ...subject, tags };
}

function filterAndSortCandidates(
  subjects: NormalizedBangumiSubject[],
  params: QuickImportParams
): NormalizedBangumiSubject[] {
  let filtered = subjects;
  const tagMatchScores = new Map<number, number>();

  if (params.year) {
    filtered = filtered.filter((s) => {
      if (!s.airDate) return false;
      return s.airDate.getUTCFullYear() === params.year;
    });
  }

  if (params.type && params.type !== "ALL") {
    const expectedType = params.type.toUpperCase();
    filtered = filtered.filter((s) => s.animeType === expectedType);
  }

  if (params.tags && params.tags.length > 0) {
    const scored = filtered.map((subject) => {
      const matchCount = params.tags!.filter((tag) => subjectMatchesSelectedTag(subject, tag)).length;
      return {
        subject,
        matchCount,
        matchesAll: matchCount === params.tags!.length
      };
    });
    const strictMatches = scored.filter((item) => item.matchesAll);
    const usableMatches = strictMatches;

    filtered = usableMatches.map((item) => {
      tagMatchScores.set(item.subject.bgmId, item.matchCount);
      return item.subject;
    });
  }

  const compareTagRelevance = (a: NormalizedBangumiSubject, b: NormalizedBangumiSubject) =>
    (tagMatchScores.get(b.bgmId) ?? 0) - (tagMatchScores.get(a.bgmId) ?? 0);

  if (params.mode === "TOP" || params.sort === "rank") {
    filtered.sort((a, b) => compareTagRelevance(a, b) || compareByField(a, b, (s) => s.bangumiRank));
  } else if (params.sort === "score") {
    filtered.sort((a, b) => compareTagRelevance(a, b) || compareByField(a, b, (s) => s.bangumiScore, true));
  } else if (params.sort === "year") {
    filtered.sort((a, b) => {
      const tagComparison = compareTagRelevance(a, b);
      if (tagComparison !== 0) return tagComparison;
      const ya = a.airDate?.getTime() ?? 0;
      const yb = b.airDate?.getTime() ?? 0;
      return yb - ya;
    });
  } else if (params.sort === "title") {
    filtered.sort((a, b) => (a.titleCn ?? a.title).localeCompare(b.titleCn ?? b.title, "zh-CN"));
  } else if (tagMatchScores.size > 0) {
    filtered.sort(compareTagRelevance);
  }

  const limit = clampLimit(params.limit);
  return Object.assign(filtered.slice(0, limit), { incomplete: isIncompleteBangumiBatch(subjects) });
}

export function getBangumiTagQueryVariants(tag: string): string[] {
  const values = expandTagQuery(tag);
  const direct = tag.trim();
  const variants = direct ? [direct, ...values] : values;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of variants) {
    const normalized = normalizeTagKey(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }

  return result;
}

export function subjectMatchesSelectedTag(
  subject: Pick<NormalizedBangumiSubject, "tags">,
  selectedTag: string
): boolean {
  const selectedCanonical = matchTagAliases(selectedTag) ?? normalizeTagKey(selectedTag);
  const selectedVariants = new Set(
    getBangumiTagQueryVariants(selectedTag).map((tag) => normalizeTagKey(tag))
  );

  for (const subjectTag of subject.tags) {
    const subjectCanonical = matchTagAliases(subjectTag);
    if (subjectCanonical !== null && subjectCanonical === selectedCanonical) {
      return true;
    }
    if (selectedVariants.has(normalizeTagKey(subjectTag))) {
      return true;
    }
  }

  return false;
}

async function fetchUserCollections(
  params: QuickImportParams
): Promise<NormalizedBangumiSubject[]> {
  const username = normalizeBangumiCollectionUserId(params.bangumiUserId);
  const collectionType = params.collectionType?.trim() ?? "collect";

  if (!username) return [];

  const limit = clampLimit(params.limit);
  const fetchTarget = params.year || params.tags?.length ? 1000 : remoteFetchTarget(params, limit);
  const validTypes = ["wish", "collect", "doing", "on_hold", "dropped"];
  const type = toBangumiCollectionType(validTypes.includes(collectionType) ? collectionType : "collect");

  const subjects: ImportSubjects = [];
  let offset = 0;
  const maxPages = Math.ceil(fetchTarget / 20);

  for (let page = 0; page < maxPages; page++) {
    const pageLimit = Math.min(20, fetchTarget - subjects.length);
    if (pageLimit <= 0) break;

    try {
      const url = `${BANGUMI_BASE_URL}/users/${encodeURIComponent(username)}/collections?subject_type=2&type=${type}&limit=${pageLimit}&offset=${offset}`;
      const response = await requestImportPage(url, {
        method: "GET",
        headers: buildHeaders(),
      });

      if (!response.ok) throw new Error(`Bangumi HTTP ${response.statusCode}`);

      const payload = await response.json<{
        data?: Array<{ subject?: unknown }>;
      }>();
      const rawItems = Array.isArray(payload.data) ? payload.data : [];

      for (let i = 0; i < rawItems.length; i += 4) {
        const batch = await Promise.all(rawItems.slice(i, i + 4).map(async (item) => {
          const raw = isRecord(item) && isRecord(item.subject) ? item.subject : null;
          if (!raw) return null;
          try {
            let subject = normalizeBangumiSubject({ ...raw, summary: raw.summary ?? raw.short_summary, rating: raw.rating ?? { score: raw.score, rank: raw.rank } });
            // The collection API returns SlimSubject, which omits the platform.
            // Fetch full metadata only when needed to verify an active filter.
            if ((!params.year || subject.airDate?.getUTCFullYear() === params.year) &&
                ((params.type && params.type !== "ALL" && !subject.animeType) || params.tags?.some((tag) => !subjectMatchesSelectedTag(subject, tag)))) {
              subject = await collectionSubjectDetail(subject.bgmId);
            }
            return subject;
          } catch { subjects.incomplete = true; return null; }
        }));
        subjects.push(...batch.filter((s): s is NormalizedBangumiSubject => s !== null));
      }

      if (rawItems.length < pageLimit) break;
      if (filterAndSortCandidates(subjects, params).length >= limit) break;
      offset += pageLimit;
    } catch {
      subjects.incomplete = true;
      break;
    }
  }

  return filterAndSortCandidates(subjects, params);
}

const collectionDetails = new Map<number, { expires: number; value: NormalizedBangumiSubject }>();
async function collectionSubjectDetail(id: number): Promise<NormalizedBangumiSubject> {
  const cached = collectionDetails.get(id);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await getBangumiSubject(id);
  collectionDetails.set(id, { expires: Date.now() + 600_000, value });
  if (collectionDetails.size > 1000) collectionDetails.delete(collectionDetails.keys().next().value!);
  return value;
}

export function normalizeBangumiCollectionUserId(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;

  const withoutMention = raw.replace(/^@+/, "").trim();
  const urlLike = /^https?:\/\//i.test(withoutMention)
    ? withoutMention
    : `https://bgm.tv/${withoutMention.replace(/^\/+/, "")}`;

  try {
    const url = new URL(urlLike);
    const segments = url.pathname.split("/").filter(Boolean);
    const userIndex = segments.findIndex((segment) => segment === "user" || segment === "users");
    const value = userIndex >= 0 ? segments[userIndex + 1] : segments[0];
    return value ? decodeURIComponent(value).trim() || null : null;
  } catch {
    return withoutMention.split(/[/?#]/)[0]?.trim() || null;
  }
}

function toBangumiCollectionType(type: string): number {
  const collectionTypeMap: Record<string, number> = {
    wish: 1,
    collect: 2,
    doing: 3,
    on_hold: 4,
    dropped: 5
  };
  return collectionTypeMap[type] ?? collectionTypeMap.collect;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function upsertBangumiSubjects(
  subjects: NormalizedBangumiSubject[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  const bgmIds = subjects.map((s) => s.bgmId);
  if (bgmIds.length === 0) return { inserted: 0, updated: 0 };

  const existing = await prisma.anime.findMany({
    where: { bgmId: { in: bgmIds } },
    select: { id: true, bgmId: true, source: true, tags: true, aliases: true, imageUrl: true, imageLargeUrl: true, imageMediumUrl: true, imageSmallUrl: true, animeType: true },
  });
  const existingMap = new Map<number, (typeof existing)[number]>();
  for (const e of existing) {
    if (e.bgmId !== null) existingMap.set(e.bgmId, e);
  }

  for (const subject of subjects) {
    if (!subject.title) continue;

    const sourceUrl = `https://bgm.tv/subject/${subject.bgmId}`;
    const rawJson = subject.rawJson as Prisma.InputJsonValue;
    const sourceId = String(subject.bgmId);

    const existingRecord = existingMap.get(subject.bgmId);

    if (existingRecord) {
      if (isProtectedAnimeSource(existingRecord.source)) continue;

      const updateData: Record<string, unknown> = {};
      addIfMissing(updateData, existingRecord, "title", subject.title);
      addIfMissing(updateData, existingRecord, "titleCn", subject.titleCn);
      addIfMissing(updateData, existingRecord, "imageUrl", subject.imageUrl);
      addIfMissingEnum(updateData, existingRecord, "imageSmallUrl", subject.imageSmallUrl);
      addIfMissingEnum(updateData, existingRecord, "imageMediumUrl", subject.imageMediumUrl);
      addIfMissingEnum(updateData, existingRecord, "imageLargeUrl", subject.imageLargeUrl);
      addIfMissing(updateData, existingRecord, "airDate", subject.airDate);
      addIfMissing(updateData, existingRecord, "year", subject.airDate?.getUTCFullYear());
      addIfMissing(updateData, existingRecord, "bangumiRank", subject.bangumiRank);
      addIfMissing(updateData, existingRecord, "bangumiScore", subject.bangumiScore);
      addIfMissing(updateData, existingRecord, "bangumiVotes", subject.bangumiVotes);
      addIfMissing(updateData, existingRecord, "animeType", subject.animeType);

      const normalizedTags = normalizeDedupedArray(subject.tags, existingRecord.tags, 30);
      if (normalizedTags !== null) updateData.tags = normalizedTags;

      const mergedAliases = mergeAliases(
        subject.titleCn ? [subject.titleCn] : [],
        existingRecord.aliases ?? []
      );
      if (mergedAliases.length > 0) updateData.aliases = mergedAliases;

      if (Object.keys(updateData).length > 0) {
        try {
          await prisma.anime.update({
            where: { id: existingRecord.id },
            data: {
              ...updateData,
              rawJson,
              fetchedAt: new Date(),
              imageStatus: (existingRecord.imageUrl || subject.imageUrl) ? "OK" : "MISSING",
            } as Prisma.AnimeUpdateInput,
          });
          updated++;
        } catch {
          continue;
        }
      }
    } else {
      try {
        await prisma.anime.create({
          data: {
            bgmId: subject.bgmId,
            title: subject.title,
            titleCn: subject.titleCn,
            summary: subject.summary,
            imageUrl: subject.imageUrl,
            imageSmallUrl: subject.imageSmallUrl,
            imageMediumUrl: subject.imageMediumUrl,
            imageLargeUrl: subject.imageLargeUrl,
            airDate: subject.airDate,
            bangumiRank: subject.bangumiRank,
            bangumiScore: subject.bangumiScore,
            bangumiVotes: subject.bangumiVotes,
            animeType: subject.animeType ?? null,
            tags: normalizeDedupedTags(subject.tags, 30),
            aliases: subject.titleCn ? [subject.titleCn] : [],
            externalLinks: [sourceUrl],
            source: ANIME_SOURCE.BANGUMI,
            sourceId,
            rawJson,
            fetchedAt: new Date(),
            imageStatus: subject.imageUrl ? "OK" : "MISSING",
            year: subject.airDate?.getUTCFullYear() ?? null,
          },
        });
        inserted++;
      } catch {
        continue;
      }
    }
  }

  void prisma.anime.findMany({
    where: { bgmId: { in: bgmIds } },
    select: {
      id: true,
      bgmId: true,
      cachedCoverUrl: true,
      cachedCoverSourceUrl: true,
      imageUrl: true,
      imageSmallUrl: true,
      imageMediumUrl: true,
      imageLargeUrl: true,
      thumbnailUrl: true
    }
  }).then(cacheAnimeCoversToCosBackground).catch((error) => {
    console.warn("[COS cover cache] batch lookup failed", error instanceof Error ? error.message : "Unknown error");
  });

  return { inserted, updated };
}

function normalizeDedupedTags(tags: string[], maxCount: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
      if (result.length >= maxCount) break;
    }
  }
  return result;
}

function normalizeDedupedArray(
  newValues: string[],
  existingValues: string[] | undefined,
  maxCount: number
): string[] | null {
  const merged = new Set<string>((existingValues ?? []).filter((v) => v.trim()));
  for (const v of newValues) {
    const trimmed = v.trim();
    if (trimmed) merged.add(trimmed);
  }
  if (merged.size === 0) return null;
  const result = Array.from(merged).slice(0, maxCount);
  const existing = existingValues ?? [];
  if (result.length === existing.length && result.every((v, i) => v === existing[i])) return null;
  return result;
}

function mergeAliases(newAliases: string[], existingAliases: string[]): string[] {
  const merged = new Set(existingAliases.filter((a) => a.trim()));
  for (const a of newAliases) {
    const trimmed = a.trim();
    if (trimmed) merged.add(trimmed);
  }
  return Array.from(merged).slice(0, 20);
}

function addIfMissing(
  target: Record<string, unknown>,
  existing: Record<string, unknown>,
  key: string,
  newValue: unknown
): void {
  const existingValue = existing[key];
  if (existingValue === null || existingValue === undefined || existingValue === "") {
    if (newValue !== null && newValue !== undefined && newValue !== "") {
      target[key] = newValue;
    }
  }
}

function addIfMissingEnum(
  target: Record<string, unknown>,
  existing: Record<string, unknown>,
  key: string,
  newValue: unknown
): void {
  const existingValue = existing[key];
  if (existingValue === null || existingValue === undefined) {
    if (newValue !== null && newValue !== undefined) {
      target[key] = newValue;
    }
  }
}
