import { fromError, ok } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { getOrCreateDefaultRun, initializeScoresForRun } from "@/lib/run-service";

interface RouteContext {
  params: {
    poolId: string;
  };
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getOrCreateDevUser();
    const run = await getOrCreateDefaultRun({
      userId: user.id,
      poolId: context.params.poolId
    });
    const scores = await initializeScoresForRun({
      userId: user.id,
      poolId: context.params.poolId,
      runId: run.id
    });

    return ok({
      run,
      scoreCount: scores.length
    });
  } catch (error) {
    return fromError(error);
  }
}
