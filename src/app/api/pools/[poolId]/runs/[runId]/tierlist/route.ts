import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { getRunTierList } from "@/lib/tier-service";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const tierList = await getRunTierList({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId
    });

    return ok(tierList);
  } catch (error) {
    return fromError(error);
  }
}
