import { fromError, ok } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { getRecalibrationNextPair } from "@/lib/recalibration-service";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
    sessionId: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getOrCreateDevUser();
    const result = await getRecalibrationNextPair({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      sessionId: context.params.sessionId
    });

    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
