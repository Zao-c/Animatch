import { NextResponse } from "next/server";
import { badRequest, fromError, ok } from "@/lib/api-response";
import { isAppError } from "@/lib/app-error";
import { requireCurrentUser } from "@/lib/auth-session";
import { getBangumiSubject, searchBangumiAnime, toBangumiSearchItem } from "@/lib/bangumi";
import { parseBangumiReference, validateDiscoveryYears } from "@/lib/anime-discovery";
import { labelAnimeTag } from "@/lib/anime-tag-dictionary";
import {
  BANGUMI_SEARCH_CIRCUIT_MS,
  beginBangumiSearch,
  canStartBangumiSearch,
  endBangumiSearch,
  recordBangumiSearchFailure,
  recordBangumiSearchSuccess
} from "@/lib/bangumi-search-circuit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));

  const reference = parseBangumiReference(query);
  const yearFrom = url.searchParams.get("yearFrom") ?? "";
  const yearTo = url.searchParams.get("yearTo") ?? "";
  const month = url.searchParams.get("month") ?? "";
  const invalidYears = validateDiscoveryYears({ yearFrom, yearTo, month });
  if (invalidYears) return badRequest(invalidYears);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return badRequest("Invalid offset");
  const tags = (url.searchParams.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  if (query.length > 200 || tags.length > 5 || tags.some((tag) => tag.length > 50)) return badRequest("Too many search terms");
  if (!query && url.searchParams.get("browse") !== "1") {
    return badRequest("q is required");
  }

  if (query && query.length < 2 && reference === null) {
    return badRequest("q must be at least 2 characters");
  }

  if (!canStartBangumiSearch()) {
    return bangumiUnavailableResponse(503);
  }

  beginBangumiSearch();

  try {
    await requireCurrentUser();
    const options: Parameters<typeof searchBangumiAnime>[1] = { limit };
    if (offset) options.offset = offset;
    if (yearFrom) options.yearFrom = Number(yearFrom);
    if (yearTo) options.yearTo = Number(yearTo);
    if (month) options.month = Number(month);
    if (tags.length) options.tags = tags.map(labelAnimeTag);
    if (url.searchParams.get("type")) options.type = url.searchParams.get("type")!;
    if (url.searchParams.get("sort")) options.sort = url.searchParams.get("sort")!;
    const subjects = reference === null
      ? await searchBangumiAnime(query, options)
      : offset === 0 ? [await getBangumiSubject(reference)] : [];
    if (subjects.some((subject) => {
      const raw = subject.rawJson;
      return raw && typeof raw === "object" && !Array.isArray(raw) && raw.type !== undefined && raw.type !== 2;
    })) return badRequest("这个链接不是动画条目，请选择 Bangumi 动画。" );
    recordBangumiSearchSuccess();

    return ok({
      items: subjects.map(toBangumiSearchItem),
      hasMore: reference === null && subjects.length === limit
    });
  } catch (error) {
    if (isAppError(error)) {
      return fromError(error);
    }

    recordBangumiSearchFailure();
    console.error("[Bangumi search route]", sanitizeBangumiRouteError(error));

    return bangumiUnavailableResponse(502);
  } finally {
    endBangumiSearch();
  }
}

function bangumiUnavailableResponse(status: 502 | 503) {
  const headers = status === 503 ? { "Retry-After": String(Math.ceil(BANGUMI_SEARCH_CIRCUIT_MS / 1000)) } : undefined;

  return NextResponse.json(
    {
      ok: false,
      error: {
        message: "Bangumi 搜索暂时不可用，请稍后重试。"
      }
    },
    { status, headers }
  );
}

function sanitizeBangumiRouteError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { name: "Unknown", message: String(error) };
  }

  const sanitized: Record<string, unknown> = {
    name: error.name,
    message: sanitizeErrorMessage(error.message)
  };

  if ("code" in error && typeof (error as NodeJS.ErrnoException).code === "string") {
    sanitized.code = (error as NodeJS.ErrnoException).code;
  }

  if ("statusCode" in error && typeof (error as Record<string, unknown>).statusCode === "number") {
    sanitized.statusCode = (error as Record<string, unknown>).statusCode;
  }

  if ("bodySnippet" in error && typeof (error as Record<string, unknown>).bodySnippet === "string") {
    sanitized.bodySnippet = sanitizeErrorMessage(
      (error as Record<string, unknown>).bodySnippet as string
    );
  }

  if (error.cause instanceof Error) {
    sanitized.cause = {
      name: error.cause.name,
      message: sanitizeErrorMessage(error.cause.message)
    };
    if ("code" in error.cause && typeof (error.cause as NodeJS.ErrnoException).code === "string") {
      (sanitized.cause as Record<string, unknown>).code = (error.cause as NodeJS.ErrnoException).code;
    }
  }

  return sanitized;
}

function sanitizeErrorMessage(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/(authorization["'\s:=]+)([^"',\s}]+)/gi, "$1[redacted]")
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, "http://[redacted]@");
}

function parseLimit(value: string | null): number {
  const parsed = value === null ? 20 : Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(20, Math.max(1, Math.trunc(parsed)));
}
