import type { AwardCeremony, Prisma } from "@prisma/client";
import { AppError } from "./app-error";

export async function requireAwardAccess(tx: Prisma.TransactionClient, event: Pick<AwardCeremony, "id" | "ownerId" | "accessMode">, userId: string) {
  if (event.ownerId === userId || event.accessMode === "LINK") return;
  const member = await tx.awardMember.findUnique({ where: { ceremonyId_userId: { ceremonyId: event.id, userId } } });
  if (member?.status !== "APPROVED") throw new AppError("请先申请加入活动，等待组织者确认", 403, "AWARD_MEMBER_REQUIRED");
}
export async function requireAwardActiveUser(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { deletedAt: true } });
  if (!user || user.deletedAt) throw new AppError("请重新登录", 401);
}
