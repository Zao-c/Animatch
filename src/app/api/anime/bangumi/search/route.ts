import { NextResponse } from "next/server";
import { badRequest, fromError, ok } from "@/lib/api-response";
import { isAppError } from "@/lib/app-error";
import { requireCurrentUser } from "@/lib/auth-session";
import { searchBangumiAnime, toBangumiSearchItem } from "@/lib/bangumi";

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

    console.error("Bangumi search failed", {
      message: toSafeBangumiSearchLogMessage(error)
    });

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

function toSafeBangumiSearchLogMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown Bangumi search error";
  }

  if (/^Bangumi search failed: HTTP \d+; body=/.test(error.message)) {
    return error.message;
  }

  if (error.message.includes("timed out")) {
    return "Bangumi search timed out";
  }

  return "Bangumi search failed";
}

function parseLimit(value: string | null): number {
  const parsed = value === null ? 20 : Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(20, Math.max(1, Math.trunc(parsed)));
}
