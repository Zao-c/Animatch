import { fromError, ok } from "@/lib/api-response";
import { loginWithFriendCode, setAuthCookie } from "@/lib/auth-session";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      username?: unknown;
      inviteCode?: unknown;
    };
    const user = await loginWithFriendCode({
      username: body.username,
      inviteCode: body.inviteCode
    });
    const response = ok({
      user
    });

    setAuthCookie(response, user);

    return response;
  } catch (error) {
    return fromError(error);
  }
}
