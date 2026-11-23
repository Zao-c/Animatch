import { NextRequest } from "next/server";
import { fromError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { submitVote } from "@/lib/season-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { poolId: string; seasonId: string } }
) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json().catch(() => ({}));
    const result = await submitVote(params.poolId, params.seasonId, user.id, {
      leftAnimeId: String(body.leftAnimeId ?? ""),
      rightAnimeId: String(body.rightAnimeId ?? ""),
      winnerAnimeId: String(body.winnerAnimeId ?? ""),
      useBiasVote: body.useBiasVote === true,
      clientMutationId: typeof body.clientMutationId === "string" ? body.clientMutationId : undefined
    });
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
