import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ANIME_SOURCE } from "@/lib/anime-source";
import {
  BANGUMI_BASE_URL,
  bangumiRequest,
  buildHeaders,
  normalizeBangumiSubject,
  type NormalizedBangumiSubject,
} from "@/lib/bangumi";
import {
  expandTagQuery,
  matchTagAliases,
  normalizeTagKey
} from "@/lib/anime-tag-dictionary";
import type { QuickImportParams } from "./quick-pool-builder";

export interface RemoteFetchResult {
  attempted: boolean;
  succeeded: boolean;
  insertedCount: number;
  updatedCount: number;
  fetchedCount: number;
  source: "BANGUMI" | null;
}

export interface RemoteFetchMeta {
  remoteFetch: RemoteFetchResult;
}

function isProtectedAnimeSource(source: string): boolean {
  return source === ANIME_SOURCE.CUSTOM_UPLOAD || source === ANIME_SOURCE.MANUAL || source === ANIME_SOURCE.TIERMAKER_IMPORT;
}

export function shouldUseRemote(params: QuickImportParams): boolean {
  return params.source === "BANGUMI" || params.source === "MIXED" || params.mode === "USER_COLLECTION";
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || limit === null) return 50;
  return Math.max(1, Math.min(limit, 100));
}

function remoteFetchTarget(params: QuickImportParams, limit: number): number {
  if (params.mode === "TAG" && params.tags && params.tags.length > 1) {
    return Math.min(100, Math.max(limit, limit * (params.tags.length + 1)));
  }
  if (params.type && params.type !== "ALL") {
    return Math.min(100, Math.max(limit, limit * 3));
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
  if (params.mode === "TAG" && params.tags && params.tags.length >= 1) {
    return fetchByTags(params);
  }

  return fetchBySearch(params, limit);
}

async function fetchBySearch(
  params: QuickImportParams,
  limit: number
): Promise<NormalizedBangumiSubject[]> {
  const allSubjects: NormalizedBangumiSubject[] = [];
  let offset = 0;
  const fetchTarget = remoteFetchTarget(params, limit);
  const maxPages = Math.ceil(Math.min(fetchTarget, 100) / 30);

  for (let page = 0; page < maxPages; page++) {
    const pageLimit = Math.min(30, fetchTarget - allSubjects.length);
    if (pageLimit <= 0) break;

    const body = buildSearchBody(params, params.mode);
    const url = `${BANGUMI_BASE_URL}/search/subjects?limit=${pageLimit}&offset=${offset}`;
    try {
      const response = await bangumiRequest(url, {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      });

      if (!response.ok) break;

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
      offset += pageLimit;
    } catch {
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

  if (params.year && mode === "YEAR") {
    filter.air_date = [`>=${params.year}-01-01`, `<=${params.year}-12-31`];
  }

  if (mode === "TAG" && params.tags && params.tags.length === 1) {
    filter.tag = params.tags;
  }

  const body: Record<string, unknown> = { filter };

  if (mode === "TOP") {
    body.sort = "rank";
  } else if (params.sort === "rank") {
    body.sort = "rank";
  } else if (params.sort === "score") {
    body.sort = "score";
  } else if (params.sort === "year") {
    body.sort = "date";
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
  const tagsToQuery = tags.slice(0, 3);

  for (const tag of tagsToQuery) {
    for (const queryTag of getBangumiTagQueryVariants(tag).slice(0, 4)) {
      if (tagsToQuery.length === 1 && allSubjectsMap.size >= fetchTarget) break;

      try {
        const url = `${BANGUMI_BASE_URL}/search/subjects?limit=30`;
        const body = buildSearchBody({ ...params, tags: [queryTag], mode: "TAG" }, "TAG");
        const response = await bangumiRequest(url, {
          method: "POST",
          headers: buildHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(body)
        });

        if (!response.ok) continue;

        const payload = await response.json<{ data?: unknown[] }>();
        const rawItems = Array.isArray(payload.data) ? payload.data : [];
        for (const item of rawItems) {
          try {
            const subj = normalizeBangumiSubject(item);
            if (!allSubjectsMap.has(subj.bgmId)) {
              allSubjectsMap.set(subj.bgmId, subj);
            }
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
  }

  const subjects = Array.from(allSubjectsMap.values());
  return filterAndSortCandidates(subjects, params);
}

function filterAndSortCandidates(
  subjects: NormalizedBangumiSubject[],
  params: QuickImportParams
): NormalizedBangumiSubject[] {
  let filtered = subjects;
  const tagMatchScores = new Map<number, number>();

  if (params.year && params.mode !== "YEAR") {
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
    const usableMatches = strictMatches.length > 0
      ? strictMatches
      : scored.filter((item) => item.matchCount > 0);

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
  } else if (tagMatchScores.size > 0) {
    filtered.sort(compareTagRelevance);
  }

  const limit = clampLimit(params.limit);
  return filtered.slice(0, limit);
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
  const fetchTarget = remoteFetchTarget(params, limit);
  const validTypes = ["wish", "collect", "doing", "on_hold", "dropped"];
  const type = toBangumiCollectionType(validTypes.includes(collectionType) ? collectionType : "collect");

  const subjects: NormalizedBangumiSubject[] = [];
  let offset = 0;
  const maxPages = Math.ceil(Math.min(fetchTarget, 100) / 30);

  for (let page = 0; page < maxPages; page++) {
    const pageLimit = Math.min(30, fetchTarget - subjects.length);
    if (pageLimit <= 0) break;

    try {
      const url = `${BANGUMI_BASE_URL}/users/${encodeURIComponent(username)}/collections?subject_type=2&type=${type}&limit=${pageLimit}&offset=${offset}`;
      const response = await bangumiRequest(url, {
        method: "GET",
        headers: buildHeaders(),
      });

      if (!response.ok) break;

      const payload = await response.json<{
        data?: Array<{ subject?: unknown }>;
      }>();
      const rawItems = Array.isArray(payload.data) ? payload.data : [];

      for (const item of rawItems) {
        const subject = isRecord(item) ? item.subject : null;
        if (subject) {
          try {
            subjects.push(normalizeBangumiSubject(subject));
          } catch {
            continue;
          }
        }
      }

      if (rawItems.length < pageLimit) break;
      offset += pageLimit;
    } catch {
      break;
    }
  }

  return filterAndSortCandidates(subjects, params);
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
