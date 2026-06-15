import { NextResponse } from "next/server";
import { badRequest, fromError, ok } from "@/lib/api-response";
import { isAppError } from "@/lib/app-error";
import { requireCurrentUser } from "@/lib/auth-session";
import { searchBangumiAnime, toBangumiSearchItem } from "@/lib/bangumi";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));

  if (!query) {
    return badRequest("q is required");
  }

  if (query.length < 2) {
    return badRequest("q must be at least 2 characters");
  }

  try {
    await requireCurrentUser();
    const subjects = await searchBangumiAnime(query, { limit });

    return ok({
      items: subjects.map(toBangumiSearchItem)
    });
  } catch (error) {
    if (isAppError(error)) {
      return fromError(error);
    }

    console.error("[Bangumi search route]", sanitizeBangumiRouteError(error));

    return NextResponse.json(
      {
        ok: false,
        error: {
          message: "Bangumi 搜索暂时不可用，请稍后重试。"
        }
      },
      { status: 502 }
    );
  }
}

function sanitizeBangumiRouteError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { name: "Unknown", message: String(error) };
  }

  const sanitized: Record<string, unknown> = {
    name: error.name,
    message: sanitizeErrorMessage(error.message),
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
    (sanitized as Record<string, unknown>).cause = {
      name: error.cause.name,
      message: sanitizeErrorMessage(error.cause.message),
    };
    if ("code" in error.cause && typeof (error.cause as NodeJS.ErrnoException).code === "string") {
      ((sanitized as Record<string, unknown>).cause as Record<string, unknown>).code = (error.cause as NodeJS.ErrnoException).code;
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
