import { fromError, ok } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import {
  getRecalibrationSuggestions
} from "@/lib/recalibration-service";
import type { RecalibrationType } from "@/lib/recalibration-rules";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url);

  try {
    const user = await getOrCreateDevUser();
    const suggestions = await getRecalibrationSuggestions({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      type: parseType(url.searchParams.get("type")),
      targetTier: url.searchParams.get("targetTier") ?? undefined,
      targetAnimeIds: parseIds(url.searchParams.get("targetAnimeIds")),
      limit: parseLimit(url.searchParams.get("limit"))
    });

    return ok(suggestions);
  } catch (error) {
    return fromError(error);
  }
}

function parseType(value: string | null): RecalibrationType {
  return value === "RANGE" || value === "FOCUS" ? value : "SMART";
}

function parseIds(value: string | null): string[] {
  return value === null
    ? []
    : value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
}

function parseLimit(value: string | null): number {
  const parsed = value === null ? 20 : Number(value);

  return Number.isFinite(parsed) ? parsed : 20;
}
