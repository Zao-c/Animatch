import { badRequest, fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { createTierShare } from "@/lib/tier-share-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      poolId?: unknown;
      runId?: unknown;
      tierLabels?: unknown;
      description?: unknown;
      expectedVersion?: unknown;
    } | null;
    const user = await requireCurrentUser();
    if (typeof body?.expectedVersion !== "string" || !body.expectedVersion.trim()) {
      return badRequest("页面缺少榜单版本，请重新载入后再分享。");
    }
    const result = await createTierShare({
      userId: user.id,
      poolId: typeof body.poolId === "string" ? body.poolId : "",
      runId: typeof body.runId === "string" ? body.runId : "",
      tierLabels: body.tierLabels,
      description: body.description,
      expectedVersion: body.expectedVersion
    });

    return ok({
      token: result.token,
      url: result.url,
      createdAt: result.share.createdAt
    });
  } catch (error) {
    return fromError(error);
  }
}
