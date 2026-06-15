import { sanitizeNextPath } from "@/lib/safe-redirect";

export interface PublicAnime {
  id: string;
  bgmId: number | null;
  title: string;
  titleCn: string | null;
  titleJa: string | null;
  titleEn: string | null;
  imageUrl: string | null;
  imageSmallUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  coverUrl: string | null;
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
  display?: EffectiveAnimeDisplay;
}

export interface EffectiveAnimeDisplay {
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  animeType: string | null;
  tags: string[];
  sourceLabel: string;
  isOverridden: boolean;
  isCoverOverridden?: boolean;
}

export interface PoolSummary {
  id: string;
  creatorId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  status: string;
  allowPublicEdit?: boolean;
  allowCommunityMatch?: boolean;
  isOfficialDemo?: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  archived?: boolean;
  animeCount?: number;
  comparisonCount?: number;
  confidenceScore?: number;
  uiStatus?: PoolManagementStatus;
  uiStatusLabel?: string;
  sourceType?: string;
  coverImages?: string[];
  defaultRunId?: string | null;
  permissions?: PoolPermissions;
}

export interface MiniMatchPreviewAnime {
  animeId: string;
  title: string;
  titleCn: string | null;
  imageUrl: string | null;
  meta: string | null;
}

export interface MiniMatchPreview {
  source: "CONTINUE_RUN" | "DEMO_POOL" | "EMPTY";
  poolId?: string;
  runId?: string;
  ctaHref?: string;
  ctaLabel: string;
  pairs: {
    left: MiniMatchPreviewAnime;
    right: MiniMatchPreviewAnime;
  }[];
}

export interface DemoPoolResponse {
  poolId: string;
  created: boolean;
  animeCount: number;
  redirectTo: string;
  isOfficialDemo: boolean;
}

export interface PoolPermissions {
  canRead: boolean;
  canPlay: boolean;
  canManage: boolean;
  canAddAnime: boolean;
  canCommunityMatch: boolean;
}

export interface AuthUser {
  id: string;
  username: string | null;
  name: string | null;
  image: string | null;
}

export interface TierMakerImportItemInput {
  title?: string;
  titleCn?: string;
  imageUrl: string;
  index?: number;
  tags?: string[];
}

export interface TierMakerPreviewItem {
  title: string;
  imageUrl: string;
  sourceIndex: number;
}

export interface TierMakerPreviewResponse {
  title: string;
  sourceUrl: string;
  total: number;
  items: TierMakerPreviewItem[];
}

export interface TierMakerImportResponse {
  added: PoolAnimeEntry[];
  skipped: PoolAnimeEntry[];
  importedCount: number;
  skippedCount: number;
}

export interface TierMakerUrlImportResponse {
  added: PoolAnimeEntry[];
  skipped: PoolAnimeEntry[];
  importedCount: number;
  skippedCount: number;
}

export type PoolManagementStatus =
  | "EMPTY"
  | "READY"
  | "IN_PROGRESS"
  | "STABLE"
  | "ARCHIVED";

export interface PoolAnimeEntry {
  id: string;
  poolId: string;
  animeId: string;
  position: number;
  note: string | null;
  initialElo: number;
  displayTitleOverride: string | null;
  coverUrlOverride: string | null;
  animeTypeOverride: string | null;
  tagsOverride: string[];
  overrideNote: string | null;
  overrideUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  anime: PublicAnime;
  display: EffectiveAnimeDisplay;
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
  scoreDistribution: RankingScoreDistribution;
  progress: RankingProgress;
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

export interface UndoLastComparisonResponse {
  undoneComparisonId: string;
  runId: string;
  poolId: string;
  message: string;
  redirectTo: string;
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
  effectiveComparisons: number;
  scoreDistribution: RankingScoreDistribution;
  progress: RankingProgress;
}

export interface RankingScoreDistribution {
  count: number;
  mean: number;
  median: number;
  std: number;
}

export interface RankingProgress {
  totalItems: number;
  effectiveComparisons: number;
  draftTarget: number;
  reliableTarget: number;
  highConfidenceTarget: number;
  progressRatio: number;
  stage: "EMPTY" | "DRAFTING" | "DRAFT_READY" | "RELIABLE" | "HIGH_CONFIDENCE";
  stageLabel: string;
  nextTargetLabel: string;
  remainingToNextStage: number;
}

export type TierKey = "S" | "A" | "B" | "C" | "D";
export type PublicTierLabels = Record<TierKey, string>;

export interface TierShareSnapshotItem {
  animeId: string;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  source: string;
  animeType?: string;
  tags?: string[];
  elo?: number;
  isLocked?: boolean;
  isEdited?: boolean;
}

export interface TierShareSnapshotTier {
  key: TierKey;
  label: string;
  items: TierShareSnapshotItem[];
}

export interface TierShareSnapshot {
  version: 1;
  generatedAt: string;
  pool: {
    id: string;
    name: string;
  };
  run: {
    id: string;
  };
  tiers: TierShareSnapshotTier[];
}

export interface PublicTierShare {
  token: string;
  title: string;
  description: string | null;
  tierLabels: PublicTierLabels;
  snapshot: TierShareSnapshot;
  createdAt: string;
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

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
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
    throw new ApiClientError(
      response.ok ? "Invalid API response" : `Request failed (${response.status})`,
      response.status
    );
  }

  if (!response.ok || payload.ok === false) {
    const message =
      payload.ok === false ? payload.error.message : `Request failed (${response.status})`;
    throw new ApiClientError(message, response.status);
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
  tags?: string[];
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
  if (params.tags !== undefined && params.tags.length > 0) {
    searchParams.set("tags", params.tags.join(","));
  }
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

export function listPools(params: {
  view?: "public" | "mine" | "all";
  q?: string;
  status?: "ACTIVE" | PoolManagementStatus;
  includeArchived?: boolean;
  sort?: "UPDATED" | "ANIME_COUNT" | "COMPARISON_COUNT" | "NAME";
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.view) searchParams.set("view", params.view);
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status);
  if (params.includeArchived) searchParams.set("includeArchived", "1");
  if (params.sort) searchParams.set("sort", params.sort);
  const query = searchParams.toString();

  return fetchJson<{ items: PoolSummary[] }>(`/api/pools${query ? `?${query}` : ""}`);
}

export function getDashboard() {
  return fetchJson<{ miniMatchPreview: MiniMatchPreview }>("/api/dashboard");
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

export function createDemoPool() {
  return fetchJson<DemoPoolResponse>("/api/demo-pool", {
    method: "POST"
  });
}

export function getMe() {
  return fetchJson<{ user: AuthUser | null }>("/api/auth/me");
}

export function friendLogin(data: { username: string; inviteCode: string }) {
  return fetchJson<{ user: AuthUser }>("/api/auth/friend-login", {
    method: "POST",
    body: data
  });
}

export function logout() {
  return fetchJson<{ ok: true }>("/api/auth/logout", {
    method: "POST"
  });
}

export function updatePool(
  poolId: string,
  data: {
    name: string;
    description?: string | null;
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
    tags?: string[];
  }
) {
  return fetchJson<PoolSummary>(`/api/pools/${poolId}`, {
    method: "PATCH",
    body: data
  });
}

export function archivePool(poolId: string) {
  return fetchJson<{ ok: true }>(`/api/pools/${poolId}`, {
    method: "DELETE"
  });
}

export function restorePool(poolId: string) {
  return fetchJson<PoolSummary>(`/api/pools/${poolId}/restore`, {
    method: "POST"
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

export function previewTierMakerTemplate(url: string) {
  return fetchJson<TierMakerPreviewResponse>("/api/import/tiermaker/preview", {
    method: "POST",
    body: { url }
  });
}

export function importTierMakerItemsToPool(
  poolId: string,
  input: {
    templateUrl: string;
    templateName?: string;
    items: TierMakerImportItemInput[];
  }
): Promise<TierMakerImportResponse>;
export function importTierMakerItemsToPool(
  poolId: string,
  input: {
    url: string;
    selectedIndexes?: number[];
  }
): Promise<TierMakerUrlImportResponse>;
export function importTierMakerItemsToPool(
  poolId: string,
  input:
    | { templateUrl: string; templateName?: string; items: TierMakerImportItemInput[] }
    | { url: string; selectedIndexes?: number[] }
): Promise<TierMakerImportResponse | TierMakerUrlImportResponse> {
  return fetchJson<TierMakerImportResponse | TierMakerUrlImportResponse>(
    `/api/pools/${poolId}/anime/tiermaker-import`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function uploadCustomItemToPool(
  poolId: string,
  input: {
    file: File;
    title?: string;
    note?: string;
    tags?: string[];
  }
) {
  const formData = new FormData();
  formData.set("file", input.file);
  if (input.title !== undefined) formData.set("title", input.title);
  if (input.note !== undefined) formData.set("note", input.note);
  if (input.tags !== undefined) formData.set("tags", JSON.stringify(input.tags));

  const response = await fetch(`/api/pools/${poolId}/custom-items`, {
    method: "POST",
    body: formData
  });
  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<{ poolAnime: PoolAnimeEntry }>
    | null;

  if (payload === null) {
    throw new Error(response.ok ? "Invalid API response" : `Request failed (${response.status})`);
  }

  if (!response.ok || payload.ok === false) {
    const message =
      payload.ok === false ? payload.error.message : `Request failed (${response.status})`;
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/" &&
      window.location.pathname !== "/login" &&
      !window.location.pathname.startsWith("/share/")
    ) {
      const next = sanitizeNextPath(
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
    throw new Error(message);
  }

  return payload.data;
}

export function removeAnimeFromPool(poolId: string, animeId: string) {
  return fetchJson<{ ok: true }>(`/api/pools/${poolId}/anime/${animeId}`, {
    method: "DELETE"
  });
}

export function updatePoolAnimeDisplay(
  poolId: string,
  animeId: string,
  data: {
    displayTitleOverride?: string;
    coverUrlOverride?: string;
    animeTypeOverride?: string;
    tagsOverride?: string[];
    overrideNote?: string;
  }
) {
  return fetchJson<{ poolAnime: PoolAnimeEntry; display: EffectiveAnimeDisplay }>(
    `/api/pools/${poolId}/anime/${animeId}`,
    {
      method: "PATCH",
      body: data
    }
  );
}

export async function uploadPoolAnimeCover(poolId: string, animeId: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`/api/pools/${poolId}/anime/${animeId}/cover`, {
    method: "POST",
    body: formData
  });
  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<{
        ok: true;
        coverUrl: string;
        poolAnime: PoolAnimeEntry;
        display: EffectiveAnimeDisplay;
      }>
    | null;

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

export function clearPoolAnimeDisplayOverrides(poolId: string, animeId: string) {
  return fetchJson<{ poolAnime: PoolAnimeEntry; display: EffectiveAnimeDisplay }>(
    `/api/pools/${poolId}/anime/${animeId}/overrides`,
    {
      method: "DELETE"
    }
  );
}

export function getOrCreateDefaultRun(poolId: string) {
  return fetchJson<{ run: PersonalRun; scoreCount: number }>(
    `/api/pools/${poolId}/runs/default`,
    {
      method: "POST"
    }
  );
}

export function listRuns(poolId: string) {
  return fetchJson<{ items: PersonalRun[] }>(`/api/pools/${poolId}/runs`);
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

export function resetRun(poolId: string, runId: string) {
  return fetchJson<{ runId: string; poolId: string; redirectTo: string }>(
    `/api/pools/${poolId}/runs/${runId}/reset`,
    {
      method: "POST"
    }
  );
}

export function undoLastComparison(poolId: string, runId: string) {
  return fetchJson<UndoLastComparisonResponse>(
    `/api/pools/${poolId}/runs/${runId}/undo-last`,
    {
      method: "POST"
    }
  );
}

export function getTierList(poolId: string, runId: string) {
  return fetchJson<TierListResponse>(`/api/pools/${poolId}/runs/${runId}/tierlist`);
}

export function createTierShare(data: {
  poolId: string;
  runId: string;
  tierLabels: PublicTierLabels;
  description?: string;
}) {
  return fetchJson<{ token: string; url: string }>("/api/tier-shares", {
    method: "POST",
    body: data
  });
}

export function getTierShare(token: string) {
  return fetchJson<PublicTierShare>(`/api/tier-shares/${token}`);
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
