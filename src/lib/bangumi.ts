import { ProxyAgent, type Dispatcher } from "undici";

const BANGUMI_BASE_URL = process.env.BANGUMI_PROXY_URL ?? "https://api.bgm.tv/v0";
const DEFAULT_USER_AGENT = "AniMatch/0.1 (https://github.com/Zao-c/Animatch)";
const FETCH_TIMEOUT_MS = 30_000;
const BANGUMI_SUBJECT_PAGE_BASE_URL = "https://bgm.tv/subject";
const ERROR_BODY_SUMMARY_LENGTH = 500;

let proxyAgentCache:
  | {
      proxyUrl: string;
      dispatcher: Dispatcher;
    }
  | undefined;

type BangumiFetchInit = RequestInit & {
  dispatcher?: Dispatcher;
};

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const accessToken = getBangumiAccessToken();
  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "application/json",
    ...extra,
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

function getBangumiAccessToken(): string {
  return process.env.BANGUMI_ACCESS_TOKEN ?? process.env.BANGUMI_TOKEN ?? "";
}

export function getBangumiProxyUrl(): string | null {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;

  return proxyUrl?.trim() || null;
}

export function getBangumiProxyDispatcher(): Dispatcher | undefined {
  const proxyUrl = getBangumiProxyUrl();

  if (proxyUrl === null) {
    return undefined;
  }

  if (proxyAgentCache === undefined || proxyAgentCache.proxyUrl !== proxyUrl) {
    proxyAgentCache = {
      proxyUrl,
      dispatcher: new ProxyAgent(proxyUrl)
    };
  }

  return proxyAgentCache.dispatcher;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const dispatcher = getBangumiProxyDispatcher();
    const requestInit: BangumiFetchInit = {
      ...init,
      signal: controller.signal
    };

    if (dispatcher !== undefined) {
      requestInit.dispatcher = dispatcher;
    }

    const response = await fetch(url, requestInit);
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Bangumi API request timed out after 30 seconds");
    }
    if (error instanceof TypeError && error.message === "fetch failed") {
      throw new Error("无法连接 Bangumi API，请确认网络环境或配置代理后重试");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface NormalizedBangumiSubject {
  bgmId: number;
  title: string;
  titleCn: string | null;
  summary: string | null;
  imageUrl: string | null;
  imageSmallUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  airDate: Date | null;
  bangumiRank: number | null;
  bangumiScore: number | null;
  bangumiVotes: number | null;
  tags: string[];
  rawJson: JsonValue;
}

export interface BangumiSearchItem {
  bangumiId: number;
  sourceId: string;
  title: string;
  titleCn: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  summary: string | null;
  tags: string[];
  airDate: string | null;
  year: number | null;
}

export interface BangumiRawSubject {
  id?: unknown;
  name?: unknown;
  name_cn?: unknown;
  summary?: unknown;
  date?: unknown;
  air_date?: unknown;
  rank?: unknown;
  rating?: {
    score?: unknown;
    total?: unknown;
  };
  images?: {
    common?: unknown;
    small?: unknown;
    grid?: unknown;
    medium?: unknown;
    large?: unknown;
  };
  tags?: unknown;
  [key: string]: unknown;
}

interface BangumiSearchResponse {
  data?: unknown;
  [key: string]: unknown;
}

export async function searchBangumiAnime(
  keyword: string,
  options: { limit?: number; offset?: number } = {}
): Promise<NormalizedBangumiSubject[]> {
  const trimmedKeyword = keyword.trim();

  if (!trimmedKeyword) {
    throw new Error("keyword is required");
  }

  const limit = clampInteger(options.limit ?? 20, 1, 30);
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const url = `${BANGUMI_BASE_URL}/search/subjects?limit=${limit}&offset=${offset}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      keyword: trimmedKeyword,
      filter: {
        type: [2]
      }
    })
  });

  if (!response.ok) {
    throw await createBangumiResponseError("search", response);
  }

  const body = (await response.json()) as BangumiSearchResponse;
  const rawItems = Array.isArray(body.data) ? body.data : [];

  return rawItems.map((item) => normalizeBangumiSubject(item));
}

export async function getBangumiSubject(
  subjectId: number
): Promise<NormalizedBangumiSubject> {
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    throw new Error("subjectId must be a positive integer");
  }

  const response = await fetchWithTimeout(`${BANGUMI_BASE_URL}/subjects/${subjectId}`, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw await createBangumiResponseError(`subject ${subjectId}`, response);
  }

  return normalizeBangumiSubject(await response.json());
}

export function normalizeBangumiSubject(raw: unknown): NormalizedBangumiSubject {
  const subject = isRecord(raw) ? (raw as BangumiRawSubject) : {};
  const bgmId = toPositiveInteger(subject.id);
  const title = firstNonEmptyString(subject.name, subject.name_cn);

  if (bgmId === null) {
    throw new Error("Bangumi subject id is required");
  }

  if (title === null) {
    throw new Error("Bangumi subject title is required");
  }

  const images = isRecord(subject.images) ? subject.images : {};
  const imageCommon = toNullableString(images.common);
  const imageSmall = toNullableString(images.small) ?? toNullableString(images.grid);
  const imageMedium = toNullableString(images.medium) ?? imageCommon;

  return {
    bgmId,
    title,
    titleCn: toNullableString(subject.name_cn),
    summary: toNullableString(subject.summary),
    imageUrl: imageCommon,
    imageSmallUrl: imageSmall,
    imageMediumUrl: imageMedium,
    imageLargeUrl: toNullableString(images.large),
    airDate: parseBangumiDate(subject.air_date ?? subject.date),
    bangumiRank: toPositiveInteger(subject.rank),
    bangumiScore: toNullableNumber(subject.rating?.score),
    bangumiVotes: toPositiveInteger(subject.rating?.total),
    tags: normalizeTags(subject.tags),
    rawJson: toJsonValue(raw)
  };
}

export function buildBangumiSubjectUrl(subjectId: number): string {
  return `${BANGUMI_SUBJECT_PAGE_BASE_URL}/${subjectId}`;
}

export function toBangumiSearchItem(subject: NormalizedBangumiSubject): BangumiSearchItem {
  return {
    bangumiId: subject.bgmId,
    sourceId: String(subject.bgmId),
    title: subject.title,
    titleCn: subject.titleCn,
    imageUrl:
      subject.imageUrl ??
      subject.imageMediumUrl ??
      subject.imageSmallUrl ??
      subject.imageLargeUrl,
    sourceUrl: buildBangumiSubjectUrl(subject.bgmId),
    summary: subject.summary,
    tags: subject.tags,
    airDate: subject.airDate?.toISOString() ?? null,
    year: subject.airDate?.getUTCFullYear() ?? null
  };
}

export function parseBangumiSubjectIds(input: string): number[] {
  const ids: number[] = [];
  const seenIds = new Set<number>();
  const matches = input.match(/(?<![\d.-])\d+(?![\d.])/g) ?? [];

  for (const match of matches) {
    const id = Number(match);

    if (Number.isSafeInteger(id) && id > 0 && !seenIds.has(id)) {
      seenIds.add(id);
      ids.push(id);
    }
  }

  return ids;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags: string[] = [];
  const seenTags = new Set<string>();

  for (const item of value) {
    const tagName = isRecord(item) ? toNullableString(item.name) : null;

    if (tagName !== null && !seenTags.has(tagName)) {
      seenTags.add(tagName);
      tags.push(tagName);
    }
  }

  return tags;
}

function parseBangumiDate(value: unknown): Date | null {
  const text = toNullableString(value);

  if (text === null) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toPositiveInteger(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function toNullableNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = toNullableString(value);

    if (text !== null) {
      return text;
    }
  }

  return null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

async function createBangumiResponseError(
  endpoint: string,
  response: Response
): Promise<Error> {
  const body = await response.text().catch(() => "");
  const bodySummary = sanitizeBangumiErrorText(body).slice(0, ERROR_BODY_SUMMARY_LENGTH);
  return new Error(
    `Bangumi ${endpoint} failed: HTTP ${response.status}; body=${bodySummary || "<empty>"}`
  );
}

function sanitizeBangumiErrorText(value: string): string {
  const accessToken = getBangumiAccessToken();
  const sanitized = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/(authorization["'\s:=]+)([^"',\s}]+)/gi, "$1[redacted]")
    .replace(/(access[_-]?token["'\s:=]+)([^"',\s}]+)/gi, "$1[redacted]")
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, "http://[redacted]@");

  return accessToken ? sanitized.replaceAll(accessToken, "[redacted]") : sanitized;
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (isRecord(value)) {
    const output: { [key: string]: JsonValue } = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue !== undefined && typeof nestedValue !== "function") {
        output[key] = toJsonValue(nestedValue);
      }
    }

    return output;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
