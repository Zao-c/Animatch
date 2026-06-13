import { ok } from "@/lib/api-response";
import { clearAuthCookie } from "@/lib/auth-session";

export async function POST() {
  const response = ok({
    ok: true
  });

  clearAuthCookie(response);

  return response;
}
