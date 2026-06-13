import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { createTierShare } from "@/lib/tier-share-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      poolId?: unknown;
      runId?: unknown;
      tierLabels?: unknown;
      description?: unknown;
    };
    const user = await requireCurrentUser();
    const result = await createTierShare({
      userId: user.id,
      poolId: typeof body.poolId === "string" ? body.poolId : "",
      runId: typeof body.runId === "string" ? body.runId : "",
      tierLabels: body.tierLabels,
      description: body.description
    });

    return ok({
      token: result.token,
      url: result.url
    });
  } catch (error) {
    return fromError(error);
  }
}
