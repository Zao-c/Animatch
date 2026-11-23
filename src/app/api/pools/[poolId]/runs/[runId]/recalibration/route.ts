import { RecalibrationSessionType } from "@prisma/client";
import { badRequest, fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { createRecalibrationSession } from "@/lib/recalibration-service";

interface RouteContext {
  params: {
    poolId: string;
    runId: string;
  };
}

interface CreateBody {
  type?: unknown;
  targetTier?: unknown;
  targetAnimeIds?: unknown;
  plannedCount?: unknown;
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const type = typeof body?.type === "string" ? body.type : "";

  if (!Object.values(RecalibrationSessionType).includes(type as RecalibrationSessionType)) {
    return badRequest("type is invalid");
  }

  try {
    const user = await requireCurrentUser();
    const result = await createRecalibrationSession({
      userId: user.id,
      poolId: context.params.poolId,
      runId: context.params.runId,
      type: type as RecalibrationSessionType,
      targetTier: typeof body?.targetTier === "string" ? body.targetTier : undefined,
      targetAnimeIds: normalizeIds(body?.targetAnimeIds),
      plannedCount: typeof body?.plannedCount === "number" ? body.plannedCount : undefined
    });

    return ok(result, { status: 201 });
  } catch (error) {
    return fromError(error);
  }
}

function normalizeIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
