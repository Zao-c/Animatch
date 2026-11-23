import { badRequest, forbidden, ok, unauthorized, fromError } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import {
  isSiteAdminUser,
  verifyAdminCode,
  createAdminSessionCookie,
  clearAdminSessionCookie
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();

    if (!isSiteAdminUser(user)) {
      return forbidden("Access denied");
    }

    const body = await request.json().catch(() => null);
    const code = (body as Record<string, unknown> | null)?.code;

    if (!verifyAdminCode(code)) {
      return forbidden("Access denied");
    }

    const response = ok({ ok: true });
    createAdminSessionCookie(response, user);

    return response;
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE() {
  try {
    const response = ok({ ok: true });
    clearAdminSessionCookie(response);

    return response;
  } catch (error) {
    return fromError(error);
  }
}
