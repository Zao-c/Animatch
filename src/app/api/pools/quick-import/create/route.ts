import { badRequest, ok, fromError } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { createPoolFromQuickImport, type QuickImportParams } from "@/lib/import/quick-pool-builder";

interface CreateBody {
  poolName: string;
  description?: string;
  visibility?: string;
  params: QuickImportParams;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateBody | null;

  if (!body || !body.params || !body.poolName) {
    return badRequest("poolName 和 params 是必填字段");
  }

  if (!body.params.source || !body.params.mode) {
    return badRequest("params.source 和 params.mode 是必填字段");
  }

  try {
    const user = await requireCurrentUser();
    const result = await createPoolFromQuickImport(
      {
        ...body.params,
        poolName: body.poolName,
        description: body.description,
        visibility: body.visibility,
      },
      user.id
    );
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
