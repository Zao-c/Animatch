import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import { isAdminEditSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { canEditPoolContent } from "@/lib/pool-permissions";
import { addQuickImportToPool } from "@/lib/import/quick-pool-builder";

interface AddBody {
  animeIds: string[];
}

export async function POST(request: Request, context: { params: { poolId: string } }) {
  const body = (await request.json().catch(() => null)) as AddBody | null;

  if (!body || !Array.isArray(body.animeIds) || body.animeIds.length === 0) {
    return badRequest("animeIds 不能为空");
  }

  try {
    const user = await requireCurrentUser();
    const pool = await prisma.customPool.findUnique({
      where: { id: context.params.poolId },
    });

    if (!pool || pool.deletedAt) {
      return notFound("番组不存在或已归档");
    }

    if (!canEditPoolContent(pool, user) && !(await isAdminEditSession(user))) {
      return forbidden("你没有权限管理这个番组");
    }

    const result = await addQuickImportToPool(context.params.poolId, body.animeIds, user.id);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
