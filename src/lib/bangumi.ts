import { Buffer } from "node:buffer";
import * as http from "node:http";
import * as https from "node:https";
import * as tls from "node:tls";
import type { Socket } from "node:net";

export const BANGUMI_BASE_URL = (process.env.BANGUMI_PROXY_URL || "").trim() || "https://api.bgm.tv/v0";
const DEFAULT_USER_AGENT = "AniMatch/0.1 (https://github.com/Zao-c/Animatch)";
const FETCH_TIMEOUT_MS = 30_000;
const BANGUMI_SUBJECT_PAGE_BASE_URL = "https://bgm.tv/subject";
const ERROR_BODY_SUMMARY_LENGTH = 500;

interface BangumiRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface BangumiResponse {
  statusCode: number;
  ok: boolean;
  text(): Promise<string>;
  json<T>(): Promise<T>;
}

export function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
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

const PROXY_ENV_KEYS = ["HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"] as const;

type NormalizedProxyEnv = {
  rawKey?: string;
  rawPresent: boolean;
  normalizedUrl?: string;
  protocol?: string;
  hostPresent: boolean;
  portPresent: boolean;
  invalidReason?: string;
};

export function normalizeProxyEnvValue(raw: string | undefined | null): {
  normalizedUrl?: string;
  invalidReason?: string;
} {
  if (raw == null) return {};
  let value = String(raw).trim();

  if (!value) return {};
  if (value === "undefined" || value === "null") {
    return { invalidReason: "empty-like-value" };
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  if (!value) return {};
  if (value === "undefined" || value === "null") {
    return { invalidReason: "empty-like-value" };
  }

  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    if (url.protocol !== "http:") {
      return { invalidReason: "unsupported-proxy-protocol" };
    }
    if (!url.hostname) {
      return { invalidReason: "missing-proxy-host" };
    }
    return { normalizedUrl: url.toString() };
  } catch {
    return { invalidReason: "invalid-proxy-url" };
  }
}

export function getBangumiProxyDiagnostic(): NormalizedProxyEnv {
  for (const key of PROXY_ENV_KEYS) {
    const raw = process.env[key];
    const rawPresent = typeof raw === "string" && raw.length > 0;
    const parsed = normalizeProxyEnvValue(raw);

    if (parsed.normalizedUrl) {
      const url = new URL(parsed.normalizedUrl);
      return {
        rawKey: key,
        rawPresent,
        normalizedUrl: parsed.normalizedUrl,
        protocol: url.protocol,
        hostPresent: Boolean(url.hostname),
        portPresent: Boolean(url.port),
      };
    }

    if (rawPresent && parsed.invalidReason) {
      logBangumiDiagnostic("proxy-env-invalid", {
        key,
        rawLength: raw.length,
        startsWithHttp: raw.trim().startsWith("http"),
        invalidReason: parsed.invalidReason,
      });
    }
  }

  return {
    rawPresent: PROXY_ENV_KEYS.some((key) => Boolean(process.env[key])),
    hostPresent: false,
    portPresent: false,
    invalidReason: "no-valid-proxy-env",
  };
}

export function getBangumiProxyUrl(): string | null {
  return getBangumiProxyDiagnostic().normalizedUrl ?? null;
}

function sanitizeDiagnostic(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeBangumiErrorText(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDiagnostic);
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      const lower = key.toLowerCase();
      if (
        lower === "authorization" ||
        lower === "bearer" ||
        lower.includes("token") ||
        lower.includes("proxy") ||
        lower.includes("secret")
      ) {
        out[key] = "[redacted]";
      } else {
        out[key] = sanitizeDiagnostic(v);
      }
    }
    return out;
  }
  return value;
}

function logBangumiDiagnostic(event: string, details: Record<string, unknown>): void {
  if (process.env.BANGUMI_DEBUG !== "1") return;
  console.error(
    "[Bangumi diagnostic]",
    event,
    sanitizeDiagnostic(details)
  );
}

function deriveRequestPath(
  proxy: NormalizedProxyEnv,
  hasToken: boolean
): string {
  if (!hasToken) return "missing-token";
  if (!proxy.normalizedUrl) return "node-https-direct";
  return "node-http-connect-proxy";
}

function safeErrorShape(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { name: "Unknown", message: String(error) };
  }
  const shape: Record<string, unknown> = {
    name: error.name,
    message: sanitizeBangumiErrorText(error.message),
  };
  if ("code" in error && typeof (error as NodeJS.ErrnoException).code === "string") {
    shape.code = (error as NodeJS.ErrnoException).code;
  }
  if (error.cause instanceof Error) {
    (shape as Record<string, unknown>).cause = {
      name: error.cause.name,
      message: sanitizeBangumiErrorText(error.cause.message),
    };
    if ("code" in error.cause && typeof (error.cause as NodeJS.ErrnoException).code === "string") {
      ((shape as Record<string, unknown>).cause as Record<string, unknown>).code = (error.cause as NodeJS.ErrnoException).code;
    }
  }
  return shape;
}

function proxyDiagnostic(proxy: NormalizedProxyEnv): Record<string, unknown> {
  return {
    hasValidProxy: Boolean(proxy.normalizedUrl),
    effectiveProxySourceKey: proxy.rawKey ?? null,
    proxyProtocol: proxy.protocol ?? null,
    proxyHostPresent: proxy.hostPresent,
    proxyPortPresent: proxy.portPresent,
  };
}

export async function bangumiRequest(
  url: string,
  init: BangumiRequestInit
): Promise<BangumiResponse> {
  try {
    const target = new URL(url);
    const proxy = getBangumiProxyDiagnostic();
    const hasToken = Boolean(getBangumiAccessToken());
    const requestPath = deriveRequestPath(proxy, hasToken);

    logBangumiDiagnostic("request-start", {
      runtime: "nodejs",
      method: init.method ?? "GET",
      targetHost: target.hostname,
      path: getUrlPath(target),
      requestPath,
      ...proxyDiagnostic(proxy),
      hasToken,
      bodyLength: init.body?.length ?? 0,
    });

    const response = await bangumiRequestText(url, init);

    return {
      statusCode: response.statusCode,
      ok: response.statusCode >= 200 && response.statusCode < 300,
      text: async () => response.bodyText,
      json: async <T>() => JSON.parse(response.bodyText) as T,
    };
  } catch (error: unknown) {
    logBangumiDiagnostic("request-error", safeErrorShape(error));

    if (isTimeoutError(error)) {
      throw new Error("Bangumi API request timed out after 30 seconds");
    }

    const errorCode = getNodeErrorCode(error);
    if (errorCode !== null) {
      throw new Error(`Unable to connect to Bangumi API (${errorCode})`);
    }

    throw error;
  }
}

interface BangumiTextResponse {
  statusCode: number;
  bodyText: string;
}

async function bangumiRequestText(
  url: string,
  init: BangumiRequestInit
): Promise<BangumiTextResponse> {
  const target = new URL(url);
  const proxy = getBangumiProxyDiagnostic();
  const requestInit = normalizeBangumiRequestInit(init);

  if (target.protocol !== "https:") {
    throw new Error("Bangumi API URL must use HTTPS");
  }

  if (proxy.normalizedUrl) {
    return requestHttpsViaConnectProxy(target, new URL(proxy.normalizedUrl), requestInit);
  }

  return requestHttps(target, requestInit);
}

interface NormalizedBangumiRequestInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function normalizeBangumiRequestInit(
  init: BangumiRequestInit
): NormalizedBangumiRequestInit {
  const headers = { ...(init.headers ?? {}) };

  if (init.body !== undefined && !hasHeader(headers, "Content-Length")) {
    headers["Content-Length"] = String(Buffer.byteLength(init.body));
  }

  return {
    method: init.method ?? "GET",
    headers,
    body: init.body,
  };
}

function requestHttps(
  target: URL,
  init: NormalizedBangumiRequestInit
): Promise<BangumiTextResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: target.hostname,
        port: target.port ? Number(target.port) : 443,
        path: getUrlPath(target),
        method: init.method,
        headers: init.headers,
        servername: target.hostname,
      },
      (res) => collectResponse(res, resolve, reject)
    );

    attachRequestHandlers(req, reject);
    writeRequestBody(req, init.body);
  });
}

function requestHttpsViaConnectProxy(
  target: URL,
  proxy: URL,
  init: NormalizedBangumiRequestInit
): Promise<BangumiTextResponse> {
  if (proxy.protocol !== "http:") {
    return Promise.reject(new Error("Unsupported Bangumi proxy protocol"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const targetPort = target.port ? Number(target.port) : 443;
    const connectReq = http.request({
      hostname: proxy.hostname,
      port: proxy.port ? Number(proxy.port) : 80,
      method: "CONNECT",
      path: `${target.hostname}:${targetPort}`,
      headers: {
        Host: `${target.hostname}:${targetPort}`,
      },
    });

    const rejectOnce = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    connectReq.setTimeout(FETCH_TIMEOUT_MS, () => {
      connectReq.destroy(new Error("Bangumi API request timed out after 30 seconds"));
    });
    connectReq.once("error", rejectOnce);
    connectReq.once("connect", (res, socket, head) => {
      if (settled) return;

      if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
        settled = true;
        socket.destroy();
        reject(new Error(`Bangumi proxy CONNECT failed: HTTP ${res.statusCode ?? "unknown"}`));
        return;
      }

      if (head.length > 0) {
        socket.unshift(head);
      }

      requestHttpsOverSocket(target, init, socket)
        .then((response) => {
          if (!settled) {
            settled = true;
            resolve(response);
          }
        })
        .catch(rejectOnce);
    });

    connectReq.end();
  });
}

function requestHttpsOverSocket(
  target: URL,
  init: NormalizedBangumiRequestInit,
  socket: Socket
): Promise<BangumiTextResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: target.hostname,
        port: target.port ? Number(target.port) : 443,
        path: getUrlPath(target),
        method: init.method,
        headers: init.headers,
        servername: target.hostname,
        createConnection: () =>
          tls.connect({
            socket,
            servername: target.hostname,
          }),
      },
      (res) => collectResponse(res, resolve, reject)
    );

    attachRequestHandlers(req, reject);
    writeRequestBody(req, init.body);
  });
}

function collectResponse(
  res: http.IncomingMessage,
  resolve: (response: BangumiTextResponse) => void,
  reject: (error: Error) => void
): void {
  const chunks: Buffer[] = [];

  res.on("data", (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.once("error", reject);
  res.once("end", () => {
    resolve({
      statusCode: res.statusCode ?? 0,
      bodyText: Buffer.concat(chunks).toString("utf8"),
    });
  });
}

function attachRequestHandlers(
  req: http.ClientRequest,
  reject: (error: Error) => void
): void {
  req.setTimeout(FETCH_TIMEOUT_MS, () => {
    req.destroy(new Error("Bangumi API request timed out after 30 seconds"));
  });
  req.once("error", reject);
}

function writeRequestBody(req: http.ClientRequest, body: string | undefined): void {
  if (body !== undefined) {
    req.write(body);
  }
  req.end();
}

function getUrlPath(url: URL): string {
  return `${url.pathname || "/"}${url.search}`;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lowerName = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lowerName);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("timed out");
}

function getNodeErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  if (error instanceof Error) {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET"]) {
      if (error.message.includes(code)) {
        return code;
      }
    }
  }

  return null;
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
  animeType?: string | null;
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
  platform?: unknown;
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
  const response = await bangumiRequest(url, {
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

  const response = await bangumiRequest(`${BANGUMI_BASE_URL}/subjects/${subjectId}`, {
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
    animeType: normalizeBangumiPlatform(toNullableString(subject.platform)),
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

function normalizeBangumiPlatform(platform: string | null): string | null {
  if (platform === null) return null;
  const value = platform.trim().toUpperCase();
  if (!value) return null;
  if (value === "TV") return "TV";
  if (value === "OVA" || value === "OAD") return "OVA";
  if (value === "MOVIE" || value === "剧场版" || value === "劇場版" || value === "映画") {
    return "MOVIE";
  }
  if (value === "WEB") return "WEB";
  return value;
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
  response: BangumiResponse
): Promise<Error> {
  const body = await response.text();
  const proxy = getBangumiProxyDiagnostic();
  const bodySummary = sanitizeBangumiErrorText(body, proxy.normalizedUrl).slice(0, ERROR_BODY_SUMMARY_LENGTH);

  logBangumiDiagnostic("response-received", {
    statusCode: response.statusCode,
    bodyLength: body.length,
    bodySnippet: bodySummary || "<empty>",
  });

  return new Error(
    `Bangumi ${endpoint} failed: HTTP ${response.statusCode}; body=${bodySummary || "<empty>"}`
  );
}

function sanitizeBangumiErrorText(value: string, proxyUrl?: string | null): string {
  const accessToken = getBangumiAccessToken();
  let sanitized = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/(authorization["'\s:=]+)([^"',\s}]+)/gi, "$1[redacted]")
    .replace(/(access[_-]?token["'\s:=]+)([^"',\s}]+)/gi, "$1[redacted]")
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, "http://[redacted]@");

  if (accessToken) {
    sanitized = sanitized.replaceAll(accessToken, "[redacted]");
  }

  if (proxyUrl) {
    sanitized = sanitized.replaceAll(proxyUrl, "[redacted]");
  }

  return sanitized;
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
