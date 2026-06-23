import { NextRequest } from "next/server";
import { badRequest, forbidden, fromError, ok } from "@/lib/api-response";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth-session";
import { createSeason, listSeasons } from "@/lib/season-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const user = await getCurrentUser();
    const seasons = await listSeasons(params.poolId, user?.id ?? null);
    return ok(seasons);
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { poolId: string } }
) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json().catch(() => ({}));
    const season = await createSeason(params.poolId, user.id, {
      title: String(body.title ?? ""),
      description: body.description,
      mode: body.mode === "BIAS" ? "BIAS" : "CLASSIC",
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      maxVotesPerUser: typeof body.maxVotesPerUser === "number" ? body.maxVotesPerUser : undefined,
      maxVotesPerUserPerDay: typeof body.maxVotesPerUserPerDay === "number" ? body.maxVotesPerUserPerDay : undefined,
      biasVotesPerUser: typeof body.biasVotesPerUser === "number" ? body.biasVotesPerUser : undefined
    });
    return ok(season);
  } catch (error) {
    return fromError(error);
  }
}
