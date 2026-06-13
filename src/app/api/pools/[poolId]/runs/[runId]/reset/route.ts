import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { resetRunForUser } from "@/lib/run-service";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const result = await resetRunForUser({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId
    });

    return ok({
      runId: result.run.id,
      poolId: context.params.poolId,
      redirectTo: result.redirectTo
    });
  } catch (error) {
    return fromError(error);
  }
}
