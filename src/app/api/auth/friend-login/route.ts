import { NextResponse } from "next/server";
import { fromError, ok } from "@/lib/api-response";
import { loginWithFriendCode, setAuthCookie } from "@/lib/auth-session";
import {
  checkFriendLoginRateLimit,
  clearFriendLoginFailures,
  getFriendLoginRateLimitKey,
  recordFriendLoginFailure
} from "@/lib/friend-login-rate-limit";

const TOO_MANY_ATTEMPTS_MESSAGE = "尝试次数过多，请稍后再试。";

export async function POST(request: Request) {
  const rateLimitKey = getFriendLoginRateLimitKey(request);
  const currentLimit = checkFriendLoginRateLimit(rateLimitKey);
  if (!currentLimit.allowed) {
    return tooManyAttempts(currentLimit.retryAfterSeconds);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      username?: unknown;
      inviteCode?: unknown;
    };
    const user = await loginWithFriendCode({
      username: body.username,
      inviteCode: body.inviteCode
    });
    clearFriendLoginFailures(rateLimitKey);

    const response = ok({
      user
    });

    setAuthCookie(response, user);

    return response;
  } catch (error) {
    const updatedLimit = recordFriendLoginFailure(rateLimitKey);
    if (!updatedLimit.allowed) {
      return tooManyAttempts(updatedLimit.retryAfterSeconds);
    }

    return fromError(error);
  }
}

function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message: TOO_MANY_ATTEMPTS_MESSAGE
      }
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds)
      }
    }
  );
}
