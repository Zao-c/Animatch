import { PoolComparisonMode, PoolComparisonResult } from "@prisma/client";
import { badRequest, forbidden, fromError, ok } from "@/lib/api-response";
import { getComparisonHistory } from "@/lib/comparison-history-service";
import { requireCurrentUser } from "@/lib/auth-session";
import { submitComparison } from "@/lib/match-service";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

interface ComparisonBody {
  leftAnimeId?: unknown;
  rightAnimeId?: unknown;
  result?: unknown;
  mode?: unknown;
  clientMutationId?: unknown;
  recalibrationSessionId?: unknown;
  expectedUserId?: unknown;
}

const RESULTS = new Set<string>(Object.values(PoolComparisonResult));
const MODES = new Set<string>(Object.values(PoolComparisonMode));

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const history = await getComparisonHistory({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      limit: limitParam === null ? undefined : Number(limitParam)
    });

    return ok(history);
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as ComparisonBody | null;
  const result = typeof body?.result === "string" ? body.result : "";
  const mode = typeof body?.mode === "string" ? body.mode : undefined;

  if (!RESULTS.has(result)) {
    return badRequest("result is invalid");
  }

  if (mode !== undefined && !MODES.has(mode)) {
    return badRequest("mode is invalid");
  }

  try {
    const user = await requireCurrentUser();
    if (body?.expectedUserId !== undefined && body.expectedUserId !== user.id) {
      return forbidden("登录账号已变化，请切回原账号后确认这次投票。");
    }
    const comparison = await submitComparison({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      leftAnimeId: typeof body?.leftAnimeId === "string" ? body.leftAnimeId : "",
      rightAnimeId: typeof body?.rightAnimeId === "string" ? body.rightAnimeId : "",
      result: result as PoolComparisonResult,
      mode: mode as PoolComparisonMode | undefined,
      clientMutationId:
        typeof body?.clientMutationId === "string" ? body.clientMutationId : "",
      recalibrationSessionId:
        typeof body?.recalibrationSessionId === "string"
          ? body.recalibrationSessionId
          : undefined
    });

    return ok(comparison);
  } catch (error) {
    return fromError(error);
  }
}
