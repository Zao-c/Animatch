export interface PublicAnime {
  id: string;
  bgmId: number | null;
  title: string;
  titleCn: string | null;
  titleJa: string | null;
  imageUrl: string | null;
  imageSmallUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  thumbnailUrl: string | null;
  airDate?: string | Date | null;
  bangumiRank: number | null;
  bangumiScore: number | null;
  tags: string[];
  aliases: string[];
  year: number | null;
  season: string | null;
  animeType: string | null;
  studios: string[];
  source: string;
}

export interface PoolSummary {
  id: string;
  creatorId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PoolAnimeEntry {
  id: string;
  poolId: string;
  animeId: string;
  position: number;
  note: string | null;
  initialElo: number;
  createdAt: string;
  anime: PublicAnime;
}

export interface PoolDetail extends PoolSummary {
  anime: PoolAnimeEntry[];
}

export interface PersonalRun {
  id: string;
  userId: string;
  poolId: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  isDefault: boolean;
  algorithmVersion: string;
  pairingVersion: string;
  tierRuleVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAnimeWithScore extends PublicAnime {
  eloScore: number;
  uncertainty: number;
  compareCount: number;
}

export interface MatchPair {
  pairId: string;
  left: PublicAnimeWithScore;
  right: PublicAnimeWithScore;
  reason: string;
}

export interface MatchQueueResponse {
  pairs: MatchPair[];
  confidenceScore: number;
}

export type ComparisonResult =
  | "LEFT_WIN"
  | "RIGHT_WIN"
  | "DRAW"
  | "SKIP"
  | "LEFT_UNSEEN"
  | "RIGHT_UNSEEN"
  | "BOTH_UNSEEN";

export interface SubmitComparisonResponse {
  comparison: {
    id: string;
    result: ComparisonResult;
    pairKey: string;
    isEffective: boolean;
    createdAt: string;
  };
  leftScore: ScoreSummary;
  rightScore: ScoreSummary;
}

export interface ScoreSummary {
  animeId: string;
  eloScore: number;
  uncertainty: number;
  compareCount: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  unseenCount: number;
  skipCount: number;
  isHidden: boolean;
}

export interface TierListItem extends PublicAnime {
  animeId: string;
  eloScore: number;
  uncertainty: number;
  compareCount: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  unseenCount: number;
  skipCount: number;
  manualTier: string | null;
  manualRank: number | null;
  manualLocked: boolean;
}

export interface TierListResponse {
  tiers: Record<"S" | "A" | "B" | "C" | "D", TierListItem[]>;
  confidenceScore: number;
  totalAnime: number;
  comparedAnime: number;
  totalComparisons: number;
}

export type RecalibrationType = "SMART" | "RANGE" | "FOCUS";
export type RecalibrationMode = "RECALIBRATE" | "FOCUS_RECALIBRATE" | "RANGE_RECALIBRATE";

export interface RecalibrationSession {
  id: string;
  userId: string;
  poolId: string;
  runId: string;
  type: RecalibrationType;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  targetTier: string | null;
  targetAnimeIds: string[];
  plannedCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecalibrationPair {
  leftAnimeId: string;
  rightAnimeId: string;
  priority: number;
  reason: string;
}

export interface RecalibrationSuggestions {
  confidenceScore: number;
  suggestedCount: number;
  unstableCount: number;
  lowDataCount: number;
  pairs: RecalibrationPair[];
}

export interface RecalibrationNextPairResponse {
  session: RecalibrationSession;
  pair: RecalibrationPair | null;
}

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: {
    message: string;
  };
};

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

interface FetchJsonOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function fetchJson<T>(
  path: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers:
      options.body === undefined
        ? undefined
        : {
            "Content-Type": "application/json"
          },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (payload === null) {
    throw new Error(response.ok ? "Invalid API response" : `Request failed (${response.status})`);
  }

  if (!response.ok || payload.ok === false) {
    const message =
      payload.ok === false ? payload.error.message : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload.data;
}

export function searchAnime(q: string, limit = 20) {
  const params = new URLSearchParams({
    q,
    limit: String(limit)
  });

  return fetchJson<{ items: PublicAnime[]; message?: string }>(`/api/anime/search?${params.toString()}`);
}

export function discoverAnime(params: {
  q?: string;
  tag?: string;
  studio?: string;
  yearFrom?: number;
  yearTo?: number;
  type?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.studio) searchParams.set("studio", params.studio);
  if (params.yearFrom) searchParams.set("yearFrom", String(params.yearFrom));
  if (params.yearTo) searchParams.set("yearTo", String(params.yearTo));
  if (params.type) searchParams.set("type", params.type);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  return fetchJson<{ items: PublicAnime[]; total: number }>(`/api/anime/discover?${searchParams.toString()}`);
}

export function createManualAnime(data: {
  title: string;
  titleCn?: string;
  titleJa?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  year?: number;
  season?: string;
  animeType?: string;
  tags?: string[];
  studios?: string[];
  summary?: string;
}) {
  return fetchJson<PublicAnime>("/api/anime/manual", {
    method: "POST",
    body: data,
  });
}

export function bulkImportAnime(input: string) {
  return fetchJson<{ imported: PublicAnime[]; failed: { bgmId: number; reason: string }[] }>(
    "/api/anime/bulk-import",
    {
      method: "POST",
      body: { input }
    }
  );
}

export function listPools() {
  return fetchJson<{ items: PoolSummary[] }>("/api/pools");
}

export function createPool(data: {
  name: string;
  description?: string;
  visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC";
  tags?: string[];
}) {
  return fetchJson<PoolSummary>("/api/pools", {
    method: "POST",
    body: data
  });
}

export function getPool(poolId: string) {
  return fetchJson<PoolDetail>(`/api/pools/${poolId}`);
}

export function addAnimeToPool(
  poolId: string,
  params: { animeId?: string; bgmId?: number }
) {
  return fetchJson<{ poolAnime: PoolAnimeEntry }>(`/api/pools/${poolId}/anime`, {
    method: "POST",
    body: params
  });
}

export function bulkImportAnimeToPool(poolId: string, input: string) {
  return fetchJson<{
    added: PoolAnimeEntry[];
    skipped: PublicAnime[];
    failed: { bgmId: number; reason: string }[];
  }>(`/api/pools/${poolId}/anime/bulk-import`, {
    method: "POST",
    body: { input }
  });
}

export function removeAnimeFromPool(poolId: string, animeId: string) {
  return fetchJson<{ ok: true }>(`/api/pools/${poolId}/anime/${animeId}`, {
    method: "DELETE"
  });
}

export function getOrCreateDefaultRun(poolId: string) {
  return fetchJson<{ run: PersonalRun; scoreCount: number }>(
    `/api/pools/${poolId}/runs/default`,
    {
      method: "POST"
    }
  );
}

export function getMatchQueue(poolId: string, runId: string, limit = 8) {
  return fetchJson<MatchQueueResponse>(
    `/api/pools/${poolId}/runs/${runId}/match-queue?limit=${limit}`
  );
}

export function submitComparison(
  poolId: string,
  runId: string,
  data: {
    leftAnimeId: string;
    rightAnimeId: string;
    result: ComparisonResult;
    mode?: "NORMAL" | RecalibrationMode;
    clientMutationId: string;
    recalibrationSessionId?: string;
  }
) {
  return fetchJson<SubmitComparisonResponse>(
    `/api/pools/${poolId}/runs/${runId}/comparisons`,
    {
      method: "POST",
      body: data
    }
  );
}

export function getTierList(poolId: string, runId: string) {
  return fetchJson<TierListResponse>(`/api/pools/${poolId}/runs/${runId}/tierlist`);
}

export function saveManualTierList(
  poolId: string,
  runId: string,
  tiers: { tier: "S" | "A" | "B" | "C" | "D"; animeIds: string[] }[]
) {
  return fetchJson<TierListResponse>(`/api/pools/${poolId}/runs/${runId}/manual-tier`, {
    method: "PATCH",
    body: { tiers }
  });
}

export function clearManualTier(poolId: string, runId: string, animeId?: string) {
  return fetchJson<TierListResponse>(`/api/pools/${poolId}/runs/${runId}/manual-tier`, {
    method: "DELETE",
    body: animeId === undefined ? {} : { animeId }
  });
}

export function getRecalibrationSuggestions(
  poolId: string,
  runId: string,
  params: {
    type?: RecalibrationType;
    targetTier?: string;
    targetAnimeIds?: string[];
    limit?: number;
  } = {}
) {
  const searchParams = new URLSearchParams();

  if (params.type !== undefined) {
    searchParams.set("type", params.type);
  }

  if (params.targetTier !== undefined) {
    searchParams.set("targetTier", params.targetTier);
  }

  if (params.targetAnimeIds !== undefined && params.targetAnimeIds.length > 0) {
    searchParams.set("targetAnimeIds", params.targetAnimeIds.join(","));
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  return fetchJson<RecalibrationSuggestions>(
    `/api/pools/${poolId}/runs/${runId}/recalibration/suggestions?${searchParams.toString()}`
  );
}

export function createRecalibrationSession(
  poolId: string,
  runId: string,
  data: {
    type: RecalibrationType;
    targetTier?: string;
    targetAnimeIds?: string[];
    plannedCount?: number;
  }
) {
  return fetchJson<{
    session: RecalibrationSession;
    suggestions: RecalibrationSuggestions;
  }>(`/api/pools/${poolId}/runs/${runId}/recalibration`, {
    method: "POST",
    body: data
  });
}

export function getRecalibrationNextPair(
  poolId: string,
  runId: string,
  sessionId: string
) {
  return fetchJson<RecalibrationNextPairResponse>(
    `/api/pools/${poolId}/runs/${runId}/recalibration/${sessionId}/next-pair`
  );
}
