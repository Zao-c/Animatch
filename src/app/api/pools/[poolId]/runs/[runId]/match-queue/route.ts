import { fromError, ok } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { getMatchQueue } from "@/lib/match-service";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));

  try {
    const user = await getOrCreateDevUser();
    const queue = await getMatchQueue({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      limit
    });

    return ok(queue);
  } catch (error) {
    return fromError(error);
  }
}

function parseLimit(value: string | null): number {
  const parsed = value === null ? 8 : Number(value);

  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(10, Math.max(1, Math.trunc(parsed)));
}
