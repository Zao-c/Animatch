import { NextRequest } from "next/server";
import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { endSeason } from "@/lib/season-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: { poolId: string; seasonId: string } }
) {
  try {
    const user = await requireCurrentUser();
    const season = await endSeason(params.poolId, params.seasonId, user.id);
    return ok(season);
  } catch (error) {
    return fromError(error);
  }
}
