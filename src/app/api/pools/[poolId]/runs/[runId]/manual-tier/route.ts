import { badRequest, fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import {
  clearManualTier,
  saveManualTierList,
  type ManualTierInput
} from "@/lib/manual-tier-service";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

interface SaveBody {
  tiers?: unknown;
  expectedVersion?: unknown;
}

interface ClearBody {
  animeId?: unknown;
  expectedVersion?: unknown;
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as SaveBody | null;

  if (!Array.isArray(body?.tiers) || typeof body?.expectedVersion !== "string") {
    return badRequest("tiers and expectedVersion are required");
  }

  try {
    const user = await requireCurrentUser();
    const tierList = await saveManualTierList({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      tiers: body.tiers as ManualTierInput[],
      expectedVersion: body.expectedVersion
    });

    return ok(tierList);
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as ClearBody | null;

  if (typeof body?.expectedVersion !== "string") {
    return badRequest("expectedVersion is required");
  }

  try {
    const user = await requireCurrentUser();
    const tierList = await clearManualTier({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      animeId: typeof body?.animeId === "string" ? body.animeId : undefined,
      expectedVersion: body.expectedVersion
    });

    return ok(tierList);
  } catch (error) {
    return fromError(error);
  }
}
