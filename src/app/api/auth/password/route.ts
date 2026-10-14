import { fromError, ok } from "@/lib/api-response";
import { changeAccountPassword, requireCurrentUser, setAuthCookie } from "@/lib/auth-session";
import { awardBody, awardHeaders } from "@/lib/award-http";
import { objectInput } from "@/lib/award-nominations";
import { prisma } from "@/lib/db";
import { checkFriendLoginRateLimit, getFriendLoginRateLimitKey, recordFriendLoginFailure } from "@/lib/friend-login-rate-limit";
import { AppError } from "@/lib/app-error";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const user = await requireCurrentUser(); const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } }); return ok({ configured: !!record.passwordHash }, { headers: awardHeaders }); }
  catch (e) { return fromError(e); }
}
export async function PUT(request: Request) {
  const key = `password:${getFriendLoginRateLimitKey(request)}`;
  try {
    if (!checkFriendLoginRateLimit(key).allowed) throw new AppError("尝试次数过多，请稍后再试", 429);
    const user = await requireCurrentUser();
    const updated = await changeAccountPassword(user.id, objectInput(await awardBody(request)));
    const response = ok({ configured: true }, { headers: awardHeaders }); setAuthCookie(response, updated); return response;
  } catch (e) { recordFriendLoginFailure(key); return fromError(e); }
}
