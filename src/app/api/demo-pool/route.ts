import { fromError, ok } from "@/lib/api-response";
import { getOrCreateDemoPool } from "@/lib/demo-pool";
import { requireCurrentUser } from "@/lib/auth-session";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    const result = await getOrCreateDemoPool(user.id);

    return ok(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return fromError(error);
  }
}
