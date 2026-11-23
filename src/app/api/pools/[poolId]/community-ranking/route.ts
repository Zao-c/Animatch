import { fromError, ok } from "@/lib/api-response";
import { getCommunityRanking } from "@/lib/community-ranking-service";

interface RouteContext {
  params: {
    poolId: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ranking = await getCommunityRanking(context.params.poolId);

    return ok(ranking);
  } catch (error) {
    return fromError(error);
  }
}
