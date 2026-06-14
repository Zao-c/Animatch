import { fromError, ok } from "@/lib/api-response";
import { getOrCreateOfficialDemoPool } from "@/lib/demo-pool";

export async function POST() {
  try {
    const result = await getOrCreateOfficialDemoPool();

    return ok(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return fromError(error);
  }
}
