import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./app-error";
import { ballotProgress, nominationSuggestions, objectInput, parseCeremony, parseEntries, parseShortlist, revisionInput, summarizeNominations,
  type AwardDefinition, type NominationEntry, type Shortlist } from "./award-nominations";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const conflict = () => new AppError("内容已在其他页面更新，请刷新后再操作；当前输入仍保留在页面。", 409);

async function lockedEvent(tx: Prisma.TransactionClient, id: string) {
  // Every writer locks the same parent before checking phase, deadline, or version.
  await tx.$queryRaw`SELECT "id" FROM "AwardCeremony" WHERE "id" = ${id} FOR UPDATE`;
  const event = await tx.awardCeremony.findUnique({ where: { id } });
  if (!event) throw new AppError("活动不存在", 404);
  return event;
}
async function submittedSummary(tx: Prisma.TransactionClient, id: string, awards: AwardDefinition[]) {
  const ballots = await tx.awardBallot.findMany({ where: { ceremonyId: id, submittedAt: { not: null } },
    select: { submitted: true, user: { select: { name: true, username: true } } } });
  return summarizeNominations(awards, ballots.map((b) => ({ name: b.user.name ?? b.user.username ?? "群友", entries: b.submitted as NominationEntry[] })));
}
export async function createCeremony(userId: string, input: unknown) {
  const parsed = parseCeremony(input);
  return prisma.awardCeremony.create({ data: { ...parsed, awards: json(parsed.awards), ownerId: userId }, select: { id: true } });
}
export async function listCeremonies(userId: string) {
  return prisma.awardCeremony.findMany({ where: { OR: [{ ownerId: userId }, { ballots: { some: { userId } } }] },
    select: { id: true, title: true, year: true, status: true, deadline: true, ownerId: true }, orderBy: { createdAt: "desc" }, take: 100 });
}
export async function getCeremony(id: string, userId: string) {
  // A repeatable snapshot prevents leaking a just-changed phase or mixing ballot revisions.
  return prisma.$transaction(async (tx) => {
    const event = await tx.awardCeremony.findUnique({ where: { id }, include: { owner: { select: { name: true, username: true } } } });
    if (!event) throw new AppError("活动不存在", 404);
    const awards = event.awards as AwardDefinition[];
    const mine = await tx.awardBallot.findUnique({ where: { ceremonyId_userId: { ceremonyId: id, userId } } });
    const submittedCount = await tx.awardBallot.count({ where: { ceremonyId: id, submittedAt: { not: null } } });
    const isOwner = event.ownerId === userId;
    const summaries = await submittedSummary(tx, id, awards);
    const shortlist = event.shortlist as Shortlist;
    return {
      id, title: event.title, year: event.year, description: event.description, deadline: event.deadline.toISOString(),
      status: event.status, revision: event.revision, awards, isOwner, ownerName: event.owner.name ?? event.owner.username ?? "组织者",
      canEdit: event.status === "OPEN" && event.deadline > new Date(), submittedCount,
      mine: { revision: mine?.revision ?? 0, draft: (mine?.draft ?? []) as NominationEntry[], submitted: (mine?.submitted ?? null) as NominationEntry[] | null,
        submittedAt: mine?.submittedAt?.toISOString() ?? null, savedAt: mine?.updatedAt.toISOString() ?? null },
      suggestions: nominationSuggestions(summaries),
      // Shared name suggestions are distinct from the organizer's confirmed shortlist.
      published: event.status === "PUBLISHED" ? awards.map((a) => ({ awardId: a.id,
        candidates: (summaries.find((s) => s.awardId === a.id)?.candidates ?? []).filter((c) => shortlist[a.id]?.includes(c.key))
          .map((c) => ({ title: c.title, workTitle: c.workTitle, ...(c.reference ? { reference: c.reference } : {}) })) })) : [],
      organizer: isOwner ? { summaries, shortlist } : null
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function getNominationSuggestions(id: string) {
  const event = await prisma.awardCeremony.findUnique({ where: { id }, select: { awards: true } });
  if (!event) throw new AppError("活动不存在", 404);
  return nominationSuggestions(await submittedSummary(prisma, id, event.awards as AwardDefinition[]));
}
export async function saveNomination(id: string, userId: string, value: unknown) {
  const input = objectInput(value), revision = revisionInput(input.revision);
  if (input.action !== "save" && input.action !== "submit") throw new AppError("未知的提名操作", 400);
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    if (event.status !== "OPEN" || event.deadline <= new Date()) throw new AppError("提名已截止，已提交的版本仍然保留。", 409);
    const awards = event.awards as AwardDefinition[], entries = parseEntries(input.entries, awards);
    if (input.action === "submit" && ballotProgress(entries, awards).remaining === awards.length) throw new AppError("请至少提名或跳过一个奖项后再提交", 400);
    const existing = await tx.awardBallot.findUnique({ where: { ceremonyId_userId: { ceremonyId: id, userId } } });
    if ((existing?.revision ?? 0) !== revision) throw conflict();
    const submission = input.action === "submit" ? { submitted: json(entries), submittedAt: new Date() } : {};
    const ballot = existing
      ? await tx.awardBallot.update({ where: { id: existing.id }, data: { draft: json(entries), revision: { increment: 1 }, ...submission } })
      : await tx.awardBallot.create({ data: { ceremonyId: id, userId, draft: json(entries), ...submission } });
    return { revision: ballot.revision, savedAt: ballot.updatedAt.toISOString(), submittedAt: ballot.submittedAt?.toISOString() ?? null };
  });
}
export async function freezeCeremony(id: string, userId: string, value: unknown) {
  const input = objectInput(value), revision = revisionInput(input.revision);
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    if (event.ownerId !== userId) throw new AppError("只有组织者可以结束征集", 403);
    if (event.revision !== revision) throw conflict();
    if (event.status !== "OPEN") throw new AppError("本届已经结束征集", 409);
    return tx.awardCeremony.update({ where: { id }, data: { status: "FROZEN", revision: { increment: 1 } }, select: { revision: true } });
  });
}
export async function deleteCeremony(id: string, userId: string, value: unknown) {
  const input = objectInput(value), revision = revisionInput(input.revision);
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    if (event.ownerId !== userId) throw new AppError("只有组织者可以删除活动", 403);
    if (event.revision !== revision) throw conflict();
    if (input.title !== event.title) throw new AppError("请输入完整活动名称以确认删除", 400);
    await tx.awardCeremony.delete({ where: { id } });
    return { deleted: true };
  });
}
export async function saveShortlist(id: string, userId: string, value: unknown) {
  const input = objectInput(value), revision = revisionInput(input.revision);
  if (typeof input.publish !== "boolean") throw new AppError("请选择保存名单或公布入围", 400);
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    if (event.ownerId !== userId) throw new AppError("只有组织者可以确认入围名单", 403);
    if (event.revision !== revision) throw conflict();
    if (event.status !== "FROZEN") throw new AppError("请先结束征集；公布后的名单不能再修改", 409);
    const summaries = await submittedSummary(tx, id, event.awards as AwardDefinition[]);
    const shortlist = parseShortlist(input.shortlist, summaries);
    if (input.publish && !Object.values(shortlist).some((keys) => keys.length)) throw new AppError("请至少选择一位入围候选", 400);
    return tx.awardCeremony.update({ where: { id }, data: { shortlist: json(shortlist), status: input.publish ? "PUBLISHED" : "FROZEN", revision: { increment: 1 } }, select: { revision: true } });
  });
}
