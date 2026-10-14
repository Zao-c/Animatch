import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./app-error";
import { ensurePublishedSnapshot, lockedEvent } from "./award-service";
import { requireAwardAccess, requireAwardActiveUser } from "./award-access";
import { objectInput, revisionInput, type AwardDefinition, type SuggestedNominee } from "./award-nominations";
import { tallyVotes, type PublishedAward, type Tally } from "./award-live-types";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const fail = (message: string, status = 409): never => { throw new AppError(message, status); };
const publishedPhases = ["PUBLISHED", "LIVE", "COMPLETED"];

export async function getAwardLive(id: string, userId: string, host = false) {
  await ensurePublishedSnapshot(id);
  return prisma.$transaction(async (tx) => {
    const event = await tx.awardCeremony.findUnique({ where: { id }, include: { stage: true, rounds: { orderBy: [{ awardId: "asc" }, { number: "asc" }] }, decisions: true } });
    if (!event) return fail("活动不存在", 404);
    await requireAwardAccess(tx, event, userId);
    const isOwner = event.ownerId === userId;
    if (host && !isOwner) return fail("只有组织者可以打开主持台", 403);
    const published = (event.publishedSnapshot ?? []) as PublishedAward[];
    const decisions = event.decisions.filter((d) => host || d.revealedAt).map((d) => ({ awardId: d.awardId, method: d.method,
      winners: d.winners as SuggestedNominee[], reason: d.reason, roundId: d.roundId, revealedAt: d.revealedAt?.toISOString() ?? null }));
    const visibleAwards = new Set(decisions.filter((d) => d.revealedAt).map((d) => d.awardId));
    const rounds = await Promise.all(event.rounds.map(async (r) => {
      const mine = await tx.awardFinalVote.findUnique({ where: { roundId_userId: { roundId: r.id, userId } } });
      const total = r.status === "OPEN" ? await tx.awardFinalVote.count({ where: { roundId: r.id } }) : (r.tally as Tally).voters;
      return { id: r.id, awardId: r.awardId, number: r.number, status: r.status, candidates: r.candidates as SuggestedNominee[],
        total, mine: mine ? { candidateKey: mine.candidateKey, revision: mine.revision } : null,
        // No unpublished aggregate, leader, or result is sent even to an owner using the audience page.
        tally: host || visibleAwards.has(r.awardId) ? r.tally as Tally | null : null };
    }));
    return { id, title: event.title, year: event.year, status: event.status, revision: event.revision, isOwner,
      awards: event.awards as AwardDefinition[], published, stage: { awardId: event.stage?.awardId ?? null, scene: event.stage?.scene ?? "WAITING" },
      rounds, decisions,
      materials: host ? await tx.awardBallot.findMany({ where: { ceremonyId: id, submittedAt: { not: null } }, select: { submitted: true } }).then((rows) => rows.flatMap((r) => (r.submitted as { awardId: string; candidates: { title: string; reason: string; mediaUrl: string }[] }[]).flatMap((e) => e.candidates.map((c) => ({ awardId: e.awardId, ...c }))))) : [],
      history: host ? await tx.awardEventLog.findMany({ where: { ceremonyId: id }, select: { action: true, createdAt: true, detail: true }, orderBy: { createdAt: "desc" }, take: 50 }) : [] };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function controlAwardLive(id: string, userId: string, value: unknown) {
  const input = objectInput(value), revision = revisionInput(input.revision);
  await ensurePublishedSnapshot(id);
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    if (event.ownerId !== userId) return fail("只有组织者可以控制颁奖", 403);
    await requireAwardActiveUser(tx, userId);
    if (!publishedPhases.includes(event.status)) return fail("请先确认并公布入围名单");
    if (event.revision !== revision) return fail("主持状态已更新，请刷新后再操作");
    const awards = event.awards as AwardDefinition[], published = event.publishedSnapshot as PublishedAward[];
    const awardId = typeof input.awardId === "string" ? input.awardId : "";
    const candidates = published.find((a) => a.awardId === awardId)?.candidates ?? [];
    const action = String(input.action);
    if (!["finish", "wait"].includes(action) && !awards.some((a) => a.id === awardId)) return fail("请选择有效奖项", 400);
    const active = await tx.awardRound.findFirst({ where: { ceremonyId: id, status: "OPEN" } });
    const decision = awardId ? await tx.awardDecision.findUnique({ where: { ceremonyId_awardId: { ceremonyId: id, awardId } } }) : null;
    if (event.status === "COMPLETED" && !["show", "wait"].includes(action)) return fail("活动已结束，结果已固定");
    let scene: string | undefined, current: string | null = awardId || null;
    if (action === "show" || action === "wait") {
      if (active && (action === "wait" || active.awardId !== awardId)) return fail("请先结束当前投票，再切换奖项");
      scene = action === "wait" ? "WAITING" : decision?.revealedAt ? "REVEALED" : active ? "VOTING" : "NOMINEES";
    } else if (action === "open" || action === "runoff") {
      if (active) return fail("已有正在进行的投票，请先关票");
      if (decision) return fail("本项已确认结果，不能重新开票");
      const previous = await tx.awardRound.findFirst({ where: { ceremonyId: id, awardId }, orderBy: { number: "desc" } });
      let nextCandidates = candidates;
      if (action === "runoff") {
        const leaders = (previous?.tally as Tally | null)?.leaders ?? [];
        if (leaders.length < 2) return fail("上一轮没有并列领先，无需加赛");
        nextCandidates = candidates.filter((c) => leaders.includes(c.key));
      } else if (previous && (previous.tally as Tally).leaders.length) return fail("已有有效结果；同票时可加赛，或确认讨论结果");
      if (!nextCandidates.length) return fail("本项没有入围候选");
      await tx.awardRound.create({ data: { ceremonyId: id, awardId, number: (previous?.number ?? 0) + 1, candidates: json(nextCandidates) } });
      scene = "VOTING";
    } else if (action === "close") {
      if (!active || active.awardId !== awardId || input.roundId !== active.id) return fail("本轮已经关闭或发生变化");
      const votes = await tx.awardFinalVote.findMany({ where: { roundId: active.id }, select: { candidateKey: true } });
      const tally = tallyVotes((active.candidates as SuggestedNominee[]).map((c) => c.key), votes);
      await tx.awardRound.update({ where: { id: active.id }, data: { status: "CLOSED", closedAt: new Date(), tally: json(tally) } });
      scene = "CLOSED";
    } else if (action === "decide") {
      if (active) return fail("请先关闭投票");
      if (decision) return fail("本项已确认结果，请按现有结果揭晓");
      const method = String(input.method), reason = typeof input.reason === "string" ? input.reason.trim() : "";
      if (reason.length > 1000) return fail("说明最多 1000 字", 400);
      let keys: string[], roundId: string | null = null;
      if (method === "VOTE") {
        const round = await tx.awardRound.findFirst({ where: { ceremonyId: id, awardId }, orderBy: { number: "desc" } });
        if (!round || round.status !== "CLOSED" || input.roundId !== round.id) return fail("请先关闭最新轮次的投票");
        keys = (round.tally as Tally).leaders;
        if (!keys.length) return fail("没有有效候选票，不能产生投票获奖者");
        roundId = round.id;
      } else if (method === "DISCUSSION" || method === "WITHHELD") {
        if (!reason) return fail("请填写讨论结论或空缺原因", 400);
        if (!Array.isArray(input.winnerKeys) || input.winnerKeys.some((k) => typeof k !== "string")) return fail("请选择获奖候选", 400);
        keys = [...new Set(input.winnerKeys as string[])];
        if (method === "WITHHELD" ? keys.length !== 0 : keys.length === 0) return fail("讨论决定需选择获奖者；空缺不选择获奖者", 400);
        if (keys.some((key) => !candidates.some((c) => c.key === key))) return fail("获奖者必须来自固定入围名单", 400);
      } else return fail("请选择投票、讨论决定或空缺", 400);
      await tx.awardDecision.create({ data: { ceremonyId: id, awardId, method, reason, roundId, winners: json(candidates.filter((c) => keys.includes(c.key))) } });
      scene = "READY";
    } else if (action === "reveal") {
      if (!decision || decision.revealedAt) return fail("请先确认结果；已揭晓的结果不能重复揭晓");
      if (active) return fail("请先关闭投票");
      await tx.awardDecision.update({ where: { id: decision.id }, data: { revealedAt: new Date() } });
      scene = "REVEALED";
    } else if (action === "finish") {
      if (active) return fail("请先关闭现场投票");
      const revealed = await tx.awardDecision.findMany({ where: { ceremonyId: id, revealedAt: { not: null } }, select: { awardId: true } });
      if (awards.some((a) => !revealed.some((d) => d.awardId === a.id))) return fail("仍有奖项未揭晓；不颁发的奖项可记录为空缺");
      scene = "FINISHED"; current = null;
    } else return fail("未知主持操作", 400);
    if (scene) await tx.awardStage.upsert({ where: { ceremonyId: id }, create: { ceremonyId: id, awardId: current, scene }, update: { awardId: current, scene } });
    await tx.awardEventLog.create({ data: { ceremonyId: id, actorId: userId, action, detail: json({ ...input, revision }) } });
    return tx.awardCeremony.update({ where: { id }, data: { status: action === "finish" ? "COMPLETED" : event.status === "COMPLETED" ? "COMPLETED" : "LIVE", revision: { increment: 1 } }, select: { revision: true } });
  });
}

export async function voteAwardLive(id: string, userId: string, value: unknown) {
  const input = objectInput(value), revision = revisionInput(input.revision);
  return prisma.$transaction(async (tx) => {
    const event = await lockedEvent(tx, id);
    await requireAwardAccess(tx, event, userId);
    await requireAwardActiveUser(tx, userId);
    if (event.status !== "LIVE") return fail("当前不在现场投票阶段");
    if (typeof input.roundId !== "string") return fail("缺少投票轮次", 400);
    const round = await tx.awardRound.findFirst({ where: { id: input.roundId, ceremonyId: id, status: "OPEN" } });
    if (!round) return fail("本轮投票已经结束，请等待下一奖项");
    if (input.candidateKey !== null && !(round.candidates as SuggestedNominee[]).some((c) => c.key === input.candidateKey)) return fail("请选择本轮候选，或弃权", 400);
    const where = { roundId_userId: { roundId: round.id, userId } };
    const existing = await tx.awardFinalVote.findUnique({ where });
    if ((existing?.revision ?? 0) !== revision) return fail("你的选票已在其他页面更新，请刷新后重试");
    const vote = existing ? await tx.awardFinalVote.update({ where, data: { candidateKey: input.candidateKey as string | null, revision: { increment: 1 } } })
      : await tx.awardFinalVote.create({ data: { roundId: round.id, userId, candidateKey: input.candidateKey as string | null } });
    return { revision: vote.revision, candidateKey: vote.candidateKey };
  });
}
