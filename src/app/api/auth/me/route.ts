import { fromError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return ok({
      user
    });
  } catch (error) {
    return fromError(error);
  }
}
