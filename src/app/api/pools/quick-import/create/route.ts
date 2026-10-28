import { badRequest, forbidden, ok, fromError } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { createPoolFromQuickImport, type QuickImportParams } from "@/lib/import/quick-pool-builder";

import { poolCreationKey } from "@/lib/pool-creation";

interface CreateBody {
  clientMutationId?: string;
  expectedUserId?: string;
  poolName: string;
  description?: string;
  visibility?: string;
  selectedAnimeIds?: string[];
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
    const key = poolCreationKey(body.clientMutationId);
    if ((key || body.expectedUserId !== undefined) && body.expectedUserId !== user.id) return forbidden("登录账号已变化，请切回原账号确认创建结果。");
    const result = await createPoolFromQuickImport(
      {
        ...body.params,
        clientMutationId: key,
        poolName: body.poolName,
        description: body.description,
        visibility: body.visibility,
        selectedAnimeIds: body.selectedAnimeIds,
      },
      user.id
    );
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
