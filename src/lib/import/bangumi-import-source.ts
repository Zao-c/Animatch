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

const SOURCES_TO_SKIP_UPSERT: string[] = [
  ANIME_SOURCE.CUSTOM_UPLOAD,
  ANIME_SOURCE.MANUAL,
  ANIME_SOURCE.TIERMAKER_IMPORT,
];

export function shouldUseRemote(params: QuickImportParams): boolean {
  return params.source === "BANGUMI" || params.source === "MIXED";
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || limit === null) return 50;
  return Math.max(1, Math.min(limit, 100));
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
  const maxPages = Math.ceil(Math.min(limit, 100) / 30);

  for (let page = 0; page < maxPages; page++) {
    const pageLimit = Math.min(30, limit - allSubjects.length);
    if (pageLimit <= 0) break;

    const body = buildSearchBody(params, params.mode);
    const url = `${BANGUMI_BASE_URL}/search/subjects?limit=${pageLimit}&offset=${offset}`;
    const response = await bangumiRequest(url, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
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

  if (params.type && params.type !== "ALL") {
    const subtypeMap: Record<string, string> = {
      TV: "TV",
      MOVIE: "MOVIE",
      OVA: "OVA",
    };
    const subtype = subtypeMap[params.type.toUpperCase()] ?? params.type.toUpperCase();
    filter.subject_type = subtype;
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
  const allSubjectsMap = new Map<number, NormalizedBangumiSubject>();

  for (const tag of tags.slice(0, 3)) {
    if (allSubjectsMap.size >= limit) break;

    try {
      const url = `${BANGUMI_BASE_URL}/search/subjects?limit=30`;
      const body = buildSearchBody({ ...params, tags: [tag], mode: "TAG" }, "TAG");
      const response = await bangumiRequest(url, {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
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

  const subjects = Array.from(allSubjectsMap.values());
  return filterAndSortCandidates(subjects, params);
}

function filterAndSortCandidates(
  subjects: NormalizedBangumiSubject[],
  params: QuickImportParams
): NormalizedBangumiSubject[] {
  let filtered = subjects;

  if (params.year && params.mode !== "YEAR") {
    filtered = filtered.filter((s) => {
      if (!s.airDate) return false;
      return s.airDate.getUTCFullYear() === params.year;
    });
  }

  if (params.type && params.type !== "ALL") {
    filtered = filtered;
  }

  if (params.mode === "TOP" || params.sort === "rank") {
    filtered.sort((a, b) => compareByField(a, b, (s) => s.bangumiRank));
  } else if (params.sort === "score") {
    filtered.sort((a, b) => compareByField(a, b, (s) => s.bangumiScore, true));
  } else if (params.sort === "year") {
    filtered.sort((a, b) => {
      const ya = a.airDate?.getTime() ?? 0;
      const yb = b.airDate?.getTime() ?? 0;
      return yb - ya;
    });
  }

  const limit = clampLimit(params.limit);
  return filtered.slice(0, limit);
}

async function fetchUserCollections(
  params: QuickImportParams
): Promise<NormalizedBangumiSubject[]> {
  const username = params.bangumiUserId?.trim();
  const collectionType = params.collectionType?.trim() ?? "collect";

  if (!username) return [];

  const limit = clampLimit(params.limit);
  const validTypes = ["wish", "collect", "doing", "on_hold", "dropped"];
  const type = validTypes.includes(collectionType) ? collectionType : "collect";

  const subjects: NormalizedBangumiSubject[] = [];
  let offset = 0;
  const maxPages = Math.ceil(Math.min(limit, 100) / 30);

  for (let page = 0; page < maxPages; page++) {
    const pageLimit = Math.min(30, limit - subjects.length);
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
    select: { id: true, bgmId: true, source: true, tags: true, aliases: true, imageUrl: true, imageLargeUrl: true, imageMediumUrl: true, imageSmallUrl: true },
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
      if (SOURCES_TO_SKIP_UPSERT.includes(existingRecord.source)) continue;

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
