import { fromError, ok } from "@/lib/api-response";
import { getOrCreateDemoPool } from "@/lib/demo-pool";
import { getOrCreateDevUser } from "@/lib/dev-user";

export async function POST() {
  try {
    const user = await getOrCreateDevUser();
    const result = await getOrCreateDemoPool(user.id);

    return ok(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return fromError(error);
  }
}
