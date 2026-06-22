import { NextRequest } from "next/server";
import { fromError, ok } from "@/lib/api-response";
import { deleteSeason, getSeasonDetail, updateSeason } from "@/lib/season-service";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth-session";

interface RouteContext {
  params: { poolId: string; seasonId: string };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    const detail = await getSeasonDetail(context.params.poolId, context.params.seasonId, user?.id ?? null);
    return ok(detail);
  } catch (error) {
    return fromError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json().catch(() => ({}));
    const season = await updateSeason(context.params.poolId, context.params.seasonId, user.id, {
      title: body.title,
      description: typeof body.description === "string" || body.description === null ? body.description : undefined,
      mode: body.mode,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt === null ? null : body.endsAt ? new Date(body.endsAt) : undefined,
      maxVotesPerUser: typeof body.maxVotesPerUser === "number" ? body.maxVotesPerUser : undefined,
      maxVotesPerUserPerDay:
        body.maxVotesPerUserPerDay === null
          ? null
          : typeof body.maxVotesPerUserPerDay === "number"
            ? body.maxVotesPerUserPerDay
            : undefined,
      biasVotesPerUser: typeof body.biasVotesPerUser === "number" ? body.biasVotesPerUser : undefined
    });
    return ok(season);
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const result = await deleteSeason(context.params.poolId, context.params.seasonId, user.id);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
