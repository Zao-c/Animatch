import { requireCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { ok, fromError } from "@/lib/api-response";
import { AppError } from "@/lib/app-error";
import { templateSummary } from "@/lib/anisong/shared/templates";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { templateId: string } }) {
  try {
    const template = await prisma.songTemplate.findFirst({ where: { id: params.templateId, active: true }, include: { owner: { select: { name: true, username: true } } } });
    if (!template) throw new AppError("公共曲单不存在或已下架", 404);
    return ok({ ...templateSummary(template), document: template.document });
  } catch (error) { return fromError(error); }
}
export async function DELETE(_request: Request, { params }: { params: { templateId: string } }) {
  try {
    const user = await requireCurrentUser();
    const changed = await prisma.songTemplate.updateMany({ where: { id: params.templateId, ownerId: user.id }, data: { active: false } });
    if (!changed.count) throw new AppError("没有管理此曲单的权限", 404);
    return ok({ unpublished: true });
  } catch (error) { return fromError(error); }
}
