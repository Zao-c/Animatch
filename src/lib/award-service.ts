import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./app-error";
import { requireAwardAccess } from "./award-access";
import type { CandidateMerge, PublishedAward } from "./award-live-types";
import { nomineeKey } from "./award-nominations";
import { ballotProgress, nominationSuggestions, objectInput, parseCeremony, parseEntries, parseShortlist, revisionInput, summarizeNominations,
  type AwardDefinition, type NominationEntry, type Shortlist } from "./award-nominations";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const conflict = () => new AppError("内容已在其他页面更新，请刷新后再操作；当前输入仍保留在页面。", 409);

export async function lockedEvent(tx: Prisma.TransactionClient, id: string) {
  // Every writer locks the same parent before checking phase, deadline, or version.
  await tx.$queryRaw`SELECT "id" FROM "AwardCeremony" WHERE "id" = ${id} FOR UPDATE`;
  const event = await tx.awardCeremony.findUnique({ where: { id } });
  if (!event) throw new AppError("活动不存在", 404);
  return event;
}
async function submittedSummary(tx: Prisma.TransactionClient, id: string, awards: AwardDefinition[]) {
  const event = await tx.awardCeremony.findUniqueOrThrow({ where: { id }, select: { merges: true } });
  const ballots = await tx.awardBallot.findMany({ where: { ceremonyId: id, submittedAt: { not: null } },
    select: { submitted: true, user: { select: { name: true, username: true } } } });
  const entries = ballots.map((b) => ({ name: b.user.name ?? b.user.username ?? "群友", entries: b.submitted as NominationEntry[] }));
  for (const merge of event.merges as CandidateMerge[]) {
    const target = entries.flatMap((b) => b.entries.filter((e) => e.awardId === merge.awardId).flatMap((e) => e.candidates)).find((c) => nomineeKey(c) === merge.to);
    if (!target) continue;
    for (const ballot of entries) for (const entry of ballot.entries) if (entry.awardId === merge.awardId) {
      entry.candidates = entry.candidates.map((c) => nomineeKey(c) === merge.from ? { ...c, title: target.title, workTitle: target.workTitle, reference: target.reference } : c);
    }
  }
  return summarizeNominations(awards, entries);
}
export async function snapshotShortlist(tx: Prisma.TransactionClient, id: string, awards: AwardDefinition[], shortlist: Shortlist): Promise<PublishedAward[]> {
  const summaries = await submittedSummary(tx, id, awards);
  return awards.map((a) => ({ awardId: a.id, candidates: (shortlist[a.id] ?? []).flatMap((key) => {
    const c = summaries.find((s) => s.awardId === a.id)?.candidates.find((n) => n.key === key);
    return c ? [{ key: c.key, title: c.title, workTitle: c.workTitle, ...(c.reference ? { reference: c.reference } : {}) }] : [];
  }) }));
}
export async function ensurePublishedSnapshot(id: string) {
  const current = await prisma.awardCeremony.findUnique({ where: { id }, select: { status: true, publishedSnapshot: true } });
  if (!current || current.publishedSnapshot || !["PUBLISHED", "LIVE", "COMPLETED"].includes(current.status)) return;
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    if (["PUBLISHED", "LIVE", "COMPLETED"].includes(event.status) && !event.publishedSnapshot) {
      await tx.awardCeremony.update({ where: { id }, data: { publishedSnapshot: json(await snapshotShortlist(tx, id, event.awards as AwardDefinition[], event.shortlist as Shortlist)) } });
    }
  });
}
export async function createCeremony(userId: string, input: unknown) {
  const parsed = parseCeremony(input);
  return prisma.awardCeremony.create({ data: { ...parsed, awards: json(parsed.awards), ownerId: userId }, select: { id: true } });
}
export async function listCeremonies(userId: string) {
  return prisma.awardCeremony.findMany({ where: { OR: [{ ownerId: userId }, { ballots: { some: { userId } } }, { members: { some: { userId } } }] },
    select: { id: true, title: true, year: true, status: true, deadline: true, ownerId: true }, orderBy: { createdAt: "desc" }, take: 100 });
}
export async function getCeremony(id: string, userId: string) {
  await ensurePublishedSnapshot(id);
  // A repeatable snapshot prevents leaking a just-changed phase or mixing ballot revisions.
  return prisma.$transaction(async (tx) => {
    const event = await tx.awardCeremony.findUnique({ where: { id }, include: { owner: { select: { name: true, username: true } } } });
    if (!event) throw new AppError("活动不存在", 404);
    await requireAwardAccess(tx, event, userId);
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
      nominationMode: event.nominationMode, accessMode: event.accessMode, eligibility: event.eligibility,
      suggestions: event.nominationMode === "ASSISTED" ? nominationSuggestions(summaries) : [],
      // Shared name suggestions are distinct from the organizer's confirmed shortlist.
      published: (event.publishedSnapshot ?? []) as PublishedAward[],
      organizer: isOwner ? { summaries, shortlist, merges: event.merges as CandidateMerge[] } : null
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function getNominationSuggestions(id: string, userId: string) {
  const event = await prisma.awardCeremony.findUnique({ where: { id } });
  if (!event) throw new AppError("活动不存在", 404);
  await requireAwardAccess(prisma, event, userId);
  if (event.nominationMode === "INDEPENDENT") return [];
  return nominationSuggestions(await submittedSummary(prisma, id, event.awards as AwardDefinition[]));
}
export async function saveNomination(id: string, userId: string, value: unknown) {
  const input = objectInput(value), revision = revisionInput(input.revision);
  if (input.action !== "save" && input.action !== "submit") throw new AppError("未知的提名操作", 400);
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    await requireAwardAccess(tx, event, userId);
    if (event.status !== "OPEN" || event.deadline <= new Date()) throw new AppError("提名已截止，已提交的版本仍然保留。", 409);
    const awards = event.awards as AwardDefinition[], entries = parseEntries(input.entries, awards, input.action === "save");
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
    return tx.awardCeremony.update({ where: { id }, data: { shortlist: json(shortlist), ...(input.publish ? { publishedSnapshot: json(await snapshotShortlist(tx, id, event.awards as AwardDefinition[], shortlist)) } : {}), status: input.publish ? "PUBLISHED" : "FROZEN", revision: { increment: 1 } }, select: { revision: true } });
  });
}

export async function mergeNominees(id: string, userId: string, value: unknown) {
  const input = objectInput(value);
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    if (event.ownerId !== userId) throw new AppError("只有组织者可以合并候选", 403);
    if (event.status !== "FROZEN" || event.revision !== revisionInput(input.revision)) throw conflict();
    const summary = (await submittedSummary(tx, id, event.awards as AwardDefinition[])).find((s) => s.awardId === input.awardId);
    if (input.from === input.to || !summary?.candidates.some((c) => c.key === input.from) || !summary.candidates.some((c) => c.key === input.to)) throw new AppError("请选择两位不同的有效候选", 400);
    const merge: CandidateMerge = { awardId: String(input.awardId), from: String(input.from), to: String(input.to), at: new Date().toISOString() };
    const shortlist = event.shortlist as Shortlist;
    shortlist[merge.awardId] = [...new Set((shortlist[merge.awardId] ?? []).map((key) => key === merge.from ? merge.to : key))];
    await tx.awardEventLog.create({ data: { ceremonyId: id, actorId: userId, action: "MERGE", detail: json(merge) } });
    return tx.awardCeremony.update({ where: { id }, data: { shortlist: json(shortlist), merges: json([...(event.merges as CandidateMerge[]), merge]), revision: { increment: 1 } }, select: { revision: true } });
  });
}

export async function ceremonyMembership(id: string, userId: string, input?: unknown) {
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    const isOwner = event.ownerId === userId;
    if (input !== undefined) {
      const value = objectInput(input);
      if (value.action === "join") {
        if (!isOwner) await tx.awardMember.upsert({ where: { ceremonyId_userId: { ceremonyId: id, userId } }, create: { ceremonyId: id, userId, status: event.accessMode === "LINK" ? "APPROVED" : "PENDING" }, update: {} });
      } else {
        if (!isOwner) throw new AppError("只有组织者可以审核成员", 403);
        if (typeof value.userId !== "string" || !["APPROVED", "REJECTED"].includes(String(value.status))) throw new AppError("成员操作无效", 400);
        await tx.awardMember.update({ where: { ceremonyId_userId: { ceremonyId: id, userId: value.userId } }, data: { status: String(value.status) } });
        await tx.awardEventLog.create({ data: { ceremonyId: id, actorId: userId, action: "MEMBER", detail: json(value) } });
      }
    }
    const mine = await tx.awardMember.findUnique({ where: { ceremonyId_userId: { ceremonyId: id, userId } } });
    return { title: event.title, accessMode: event.accessMode, isOwner, status: isOwner || event.accessMode === "LINK" ? "APPROVED" : mine?.status ?? "NONE",
      members: isOwner ? await tx.awardMember.findMany({ where: { ceremonyId: id }, select: { userId: true, status: true, user: { select: { username: true, name: true } } }, orderBy: { createdAt: "asc" } }) : [] };
  });
}
