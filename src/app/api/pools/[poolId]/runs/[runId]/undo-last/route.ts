import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { undoLastComparison } from "@/lib/undo-comparison-service";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const result = await undoLastComparison({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId
    });

    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
