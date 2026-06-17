import { NextResponse } from "next/server";
import { badRequest, forbidden, notFound, ok, unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { searchBangumiAnime, type NormalizedBangumiSubject } from "@/lib/bangumi";
import { prisma } from "@/lib/db";
import { canEditPoolContent } from "@/lib/pool-permissions";
import { getEffectiveAnimeDisplay } from "@/lib/anime-display";
import { prewarmCoverCacheBackground } from "@/lib/server/cover-cache-prewarm";

export const runtime = "nodejs";

const MAX_CANDIDATES = 15;
const HIGH_CONFIDENCE_THRESHOLD = 0.8;

interface RouteContext {
  params: {
    poolId: string;
  };
}

export interface RepairCandidate {
  animeId: string;
  title: string;
  currentCoverUrl: string | null;
  match: {
    bgmId: number;
    title: string;
    titleCn: string | null;
    imageUrl: string | null;
    imageMediumUrl: string | null;
    imageLargeUrl: string | null;
    confidence: number;
  } | null;
  hasExistingOverride: boolean;
  suggestion: "auto" | "manual" | "none" | "skipped";
}

interface RepairScanResponse {
  poolId: string;
  total: number;
  needsRepair: number;
  hasExistingOverride: number;
  autoMatchCount: number;
  manualRequiredCount: number;
  skippedCount: number;
  candidates: RepairCandidate[];
}

interface RepairApplyBody {
  entries: Array<{ animeId: string; bgmId: number }>;
}

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return unauthorized("请先登录。");

  const pool = await prisma.customPool.findUnique({
    where: { id: context.params.poolId }
  });

  if (pool === null) return notFound("Pool not found");

  if (!canEditPoolContent(pool, user)) {
    return forbidden("你没有权限管理这个番组。");
  }

  const entries = await prisma.poolAnime.findMany({
    where: {
      poolId: pool.id,
      anime: {
        OR: [
          { source: "TIERMAKER_IMPORT" },
          { imageUrl: { contains: "tiermaker.com" } }
        ]
      }
    },
    include: {
      anime: true
    },
    orderBy: { position: "asc" },
    take: MAX_CANDIDATES
  });

  const candidates: RepairCandidate[] = [];
  let hasExistingOverride = 0;
  let autoMatchCount = 0;
  let manualRequiredCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const display = getEffectiveAnimeDisplay(entry);

    if (display.isCoverOverridden) {
      hasExistingOverride++;
      candidates.push({
        animeId: entry.animeId,
        title: display.title,
        currentCoverUrl: display.coverUrl,
        match: null,
        hasExistingOverride: true,
        suggestion: "skipped"
      });
      continue;
    }

    const searchTitle = display.title;
    if (!searchTitle || searchTitle === "未命名作品") {
      skippedCount++;
      candidates.push({
        animeId: entry.animeId,
        title: display.title,
        currentCoverUrl: display.coverUrl,
        match: null,
        hasExistingOverride: false,
        suggestion: "none"
      });
      continue;
    }

    let match: NormalizedBangumiSubject | null = null;
    let confidenceValue = 0;

    try {
      const results = await searchBangumiAnime(searchTitle, { limit: 5 });
      const best = findBestBangumiMatch(searchTitle, results);
      match = best.subject;
      confidenceValue = best.confidence;
    } catch {
      match = null;
      confidenceValue = 0;
    }

    if (match === null || confidenceValue < HIGH_CONFIDENCE_THRESHOLD) {
      manualRequiredCount++;
      candidates.push({
        animeId: entry.animeId,
        title: display.title,
        currentCoverUrl: display.coverUrl,
        match: null,
        hasExistingOverride: false,
        suggestion: "manual"
      });
      continue;
    }

    autoMatchCount++;
    candidates.push({
      animeId: entry.animeId,
      title: display.title,
      currentCoverUrl: display.coverUrl,
      match: {
        bgmId: match.bgmId,
        title: match.title,
        titleCn: match.titleCn,
        imageUrl: match.imageUrl,
        imageMediumUrl: match.imageMediumUrl,
        imageLargeUrl: match.imageLargeUrl,
        confidence: confidenceValue
      },
      hasExistingOverride: false,
      suggestion: "auto"
    });
  }

  const response: RepairScanResponse = {
    poolId: pool.id,
    total: entries.length,
    needsRepair: entries.length - hasExistingOverride,
    hasExistingOverride,
    autoMatchCount,
    manualRequiredCount,
    skippedCount,
    candidates
  };

  return ok(response);
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return unauthorized("请先登录。");

  const pool = await prisma.customPool.findUnique({
    where: { id: context.params.poolId }
  });

  if (pool === null) return notFound("Pool not found");

  if (!canEditPoolContent(pool, user)) {
    return forbidden("你没有权限管理这个番组。");
  }

  let body: RepairApplyBody;

  try {
    body = (await request.json()) as RepairApplyBody;
  } catch {
    return badRequest("invalid json body");
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return badRequest("entries is required and must be a non-empty array");
  }

  if (body.entries.length > MAX_CANDIDATES) {
    return badRequest(`too many entries, max ${MAX_CANDIDATES}`);
  }

  const animeIds = body.entries.map((e) => e.animeId);
  const entries = await prisma.poolAnime.findMany({
    where: {
      poolId: pool.id,
      animeId: { in: animeIds },
      coverUrlOverride: null
    },
    include: { anime: true }
  });

  const bgmIdByAnimeId = new Map<string, number>();
  for (const entry of body.entries) {
    bgmIdByAnimeId.set(entry.animeId, entry.bgmId);
  }

  const applied: Array<{ animeId: string; coverUrl: string }> = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const bgmId = bgmIdByAnimeId.get(entry.animeId);
    if (bgmId === undefined) continue;

    try {
      const subject = await prisma.anime.findUnique({
        where: { bgmId }
      });

      if (subject === null) {
        skipped.push(entry.animeId);
        continue;
      }

      const coverUrl =
        subject.imageLargeUrl ?? subject.imageMediumUrl ?? subject.imageUrl ?? null;

      if (coverUrl === null) {
        skipped.push(entry.animeId);
        continue;
      }

      await prisma.poolAnime.update({
        where: { id: entry.id },
        data: { coverUrlOverride: coverUrl }
      });

      applied.push({ animeId: entry.animeId, coverUrl });
    } catch {
      skipped.push(entry.animeId);
    }
  }

  prewarmCoverCacheBackground(
    applied.map((a) => a.coverUrl),
    { limit: 30, concurrency: 5 }
  );

  return ok({
    applied: applied.length,
    skipped: skipped.length,
    details: { applied, skipped }
  });
}

function findBestBangumiMatch(
  title: string,
  candidates: NormalizedBangumiSubject[]
): { subject: NormalizedBangumiSubject | null; confidence: number } {
  if (candidates.length === 0) {
    return { subject: null, confidence: 0 };
  }

  const searchTitle = title.toLowerCase().trim();

  for (const candidate of candidates) {
    const cn = (candidate.titleCn ?? "").toLowerCase().trim();
    const ja = (candidate.title ?? "").toLowerCase().trim();

    if (cn === searchTitle || ja === searchTitle) {
      return { subject: candidate, confidence: 1.0 };
    }
  }

  for (const candidate of candidates) {
    const cn = (candidate.titleCn ?? "").toLowerCase().trim();
    const allTitles = (candidate.title ?? "").toLowerCase().trim();

    if (cn && searchTitle.includes(cn) && cn.length >= 2) {
      return { subject: candidate, confidence: 0.85 };
    }
    if (allTitles && searchTitle.includes(allTitles) && allTitles.length >= 3) {
      return { subject: candidate, confidence: 0.85 };
    }
  }

  for (const candidate of candidates) {
    const cn = (candidate.titleCn ?? "").toLowerCase().trim();
    const allTitles = (candidate.title ?? "").toLowerCase().trim();

    if (cn && searchTitle.includes(cn.substring(0, Math.min(cn.length, 4))) && cn.length >= 2) {
      return { subject: candidate, confidence: 0.82 };
    }
    if (allTitles && searchTitle.includes(allTitles.substring(0, Math.min(allTitles.length, 4))) && allTitles.length >= 3) {
      return { subject: candidate, confidence: 0.82 };
    }
  }

  return { subject: candidates[0], confidence: 0.5 };
}
