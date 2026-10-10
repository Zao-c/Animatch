import { AppError } from "./app-error";

export type AwardDefinition = { id: string; category: string; title: string };
export type Nominee = { title: string; workTitle: string; reason: string; mediaUrl: string };
export type NominationEntry = { awardId: string; skipped: boolean; candidates: Nominee[] };
export type Shortlist = Record<string, string[]>;
export type NominationSummary = {
  awardId: string; participantCount: number; skippedCount: number;
  candidates: { key: string; title: string; workTitle: string; count: number;
    supporters: { name: string; reason: string; mediaUrl: string }[] }[];
};

const groups = [
  ["作品综合", "最佳动画", "最佳单集", "最佳动画电影", "最佳短篇 / 特别篇"],
  ["角色", "最佳男主角", "最佳女主角", "最佳男配角", "最佳女配角", "最佳 CP", "最佳反派"],
  ["制作", "最佳监督", "最佳编剧", "最佳男声优", "最佳女声优", "最佳配乐"],
  ["音乐", "最佳 OP", "最佳 ED", "最佳动画音乐"],
  ["来源与类型", "最佳原创动画", "最佳改编动画", "最佳续作动画", "最佳恋爱动画", "最佳喜剧动画", "最佳治愈动画", "最佳战斗动画", "最佳异世界动画"],
  ["观众感受", "最惊喜动画", "最失望动画", "最想安利动画", "最怪但我喜欢"],
  ["演出作画", "最佳作画片段", "最佳演出回", "最有记忆点场面"]
];
export const AWARD_TEMPLATE: AwardDefinition[] = groups.flatMap(([category, ...titles], group) =>
  titles.map((title, index) => ({ id: `award-${group}-${index}`, category, title: `年度${title}` })));
export const CEREMONY_STATUS: Record<string, string> = { OPEN: "征集提名", FROZEN: "整理入围", PUBLISHED: "入围已公布" };

function invalid(message: string): never { throw new AppError(message, 400, "AWARD_INVALID"); }
export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("请求内容格式不正确");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, label: string, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > max) invalid(`${label}最多 ${max} 字`);
  const result = value.trim();
  if (required && !result) invalid(`请填写${label}`);
  return result;
}
export function parseCeremony(value: unknown, now = new Date()) {
  const input = objectInput(value);
  const title = text(input.title, 100, "活动名称", true);
  const description = text(input.description, 1500, "作品资格与活动说明");
  if (!Number.isInteger(input.year) || Number(input.year) < 1960 || Number(input.year) > 2200) invalid("请选择有效年份");
  const deadline = new Date(typeof input.deadline === "string" ? input.deadline : "");
  if (!Number.isFinite(deadline.getTime()) || deadline <= now) invalid("提名截止时间必须在未来");
  if (!Array.isArray(input.awardIds) || !input.awardIds.length || input.awardIds.length > AWARD_TEMPLATE.length) invalid("至少选择一个奖项");
  const ids = new Set(input.awardIds);
  if (ids.size !== input.awardIds.length || [...ids].some((id) => !AWARD_TEMPLATE.some((a) => a.id === id))) invalid("奖项选择无效");
  return { title, description, year: Number(input.year), deadline, awards: AWARD_TEMPLATE.filter((a) => ids.has(a.id)) };
}
export function revisionInput(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) invalid("缺少有效版本，请刷新后重试");
  return Number(value);
}
export function nomineeKey(nominee: Pick<Nominee, "title" | "workTitle">): string {
  const normalize = (v: string) => v.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  return JSON.stringify([normalize(nominee.title), normalize(nominee.workTitle)]);
}
export function parseEntries(value: unknown, awards: AwardDefinition[]): NominationEntry[] {
  if (!Array.isArray(value) || value.length > awards.length) invalid("提名表格式不正确");
  const seen = new Set<string>();
  return value.map((raw) => {
    const entry = objectInput(raw);
    if (typeof entry.awardId !== "string" || !awards.some((a) => a.id === entry.awardId) || seen.has(entry.awardId)) invalid("奖项不存在或重复");
    seen.add(entry.awardId);
    if (typeof entry.skipped !== "boolean" || !Array.isArray(entry.candidates) || entry.candidates.length > 3) invalid("每项最多提名 3 位候选");
    if (entry.skipped && entry.candidates.length) invalid("跳过的奖项不能同时填写候选");
    const keys = new Set<string>();
    const candidates = entry.candidates.map((rawCandidate) => {
      const candidate = objectInput(rawCandidate);
      const nominee = { title: text(candidate.title, 150, "候选名称", true), workTitle: text(candidate.workTitle, 150, "所属作品"),
        reason: text(candidate.reason, 1000, "提名理由"), mediaUrl: text(candidate.mediaUrl, 1000, "素材链接") };
      if (nominee.mediaUrl) {
        let url: URL;
        try { url = new URL(nominee.mediaUrl); } catch { invalid("素材链接需要完整的 http 或 https 地址"); }
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) invalid("素材链接需要不含账号密码的 http 或 https 地址");
      }
      const key = nomineeKey(nominee);
      if (keys.has(key)) invalid("同一个奖项不能重复提名同一候选");
      keys.add(key);
      return nominee;
    });
    return { awardId: entry.awardId, skipped: entry.skipped, candidates };
  });
}
export function ballotProgress(entries: NominationEntry[], awards: AwardDefinition[]) {
  const nominated = entries.filter((e) => !e.skipped && e.candidates.length > 0).length;
  const skipped = entries.filter((e) => e.skipped).length;
  return { nominated, skipped, remaining: awards.length - nominated - skipped };
}
export function summarizeNominations(awards: AwardDefinition[], ballots: { name: string; entries: NominationEntry[] }[]): NominationSummary[] {
  return awards.map((award) => {
    const map = new Map<string, NominationSummary["candidates"][number]>();
    let participantCount = 0, skippedCount = 0;
    for (const ballot of ballots) {
      const entry = ballot.entries.find((e) => e.awardId === award.id);
      if (!entry) continue;
      if (entry.skipped) { skippedCount++; continue; }
      if (entry.candidates.length) participantCount++;
      const seen = new Set<string>();
      for (const candidate of entry.candidates) {
        const key = nomineeKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        const current = map.get(key) ?? { key, title: candidate.title, workTitle: candidate.workTitle, count: 0, supporters: [] };
        current.count++;
        current.supporters.push({ name: ballot.name, reason: candidate.reason, mediaUrl: candidate.mediaUrl });
        map.set(key, current);
      }
    }
    return { awardId: award.id, participantCount, skippedCount, candidates: [...map.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)) };
  });
}
export function parseShortlist(value: unknown, summaries: NominationSummary[]): Shortlist {
  const input = objectInput(value);
  const result: Shortlist = {};
  for (const [awardId, keys] of Object.entries(input)) {
    const summary = summaries.find((s) => s.awardId === awardId);
    if (!summary || !Array.isArray(keys) || keys.length > 12 || keys.some((key) => typeof key !== "string" || !summary.candidates.some((c) => c.key === key))) invalid("入围名单包含无效候选，或单项超过 12 位");
    if (new Set(keys).size !== keys.length) invalid("入围名单存在重复候选");
    result[awardId] = keys as string[];
  }
  return result;
}
// Exports are also safe to open in spreadsheet applications.
export function csvCell(value: string | number): string {
  const input = String(value);
  const safe = /^[\s]*[=+@-]/.test(input) || /^[\t\r\n]/.test(input) ? `'${input}` : input;
  return `"${safe.replace(/"/g, '""')}"`;
}
