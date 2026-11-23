import { fromError, ok } from "@/lib/api-response";
import { getPublicTierShare } from "@/lib/tier-share-service";

interface RouteContext {
  params: {
    token: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    return ok(await getPublicTierShare(context.params.token));
  } catch (error) {
    return fromError(error);
  }
}
