import type { AwardDefinition, SuggestedNominee } from "./award-nominations";
import type { PublishedAward } from "./award-live-types";

export function awardPreparationScene(
  decision: { revealedAt: string | null } | undefined,
  round: { status: string } | undefined
) {
  if (decision) return decision.revealedAt ? "REVEALED" : "READY";
  if (round) return round.status === "OPEN" ? "VOTING" : "CLOSED";
  return "NOMINEES";
}

export function nextUnrevealedAward(awards: { id: string }[], selected: string, revealed: { awardId: string }[]) {
  const current = awards.findIndex((a) => a.id === selected);
  const order = [...awards.slice(current + 1), ...awards.slice(0, Math.max(0, current))];
  return order.find((a) => !revealed.some((d) => d.awardId === a.id))?.id ?? null;
}

export function buildHostScript(data: {
  title: string;
  year: number;
  awards: AwardDefinition[];
  published: PublishedAward[];
  materials: { awardId: string; title: string; reason?: string; mediaUrl?: string }[];
}) {
  const lines = [`${data.year} · ${data.title}`, "主持准备稿 · 入围与素材", "不包含选票、计票和未揭晓结果。素材内容可能涉及剧透，请在直播前检查。", ""];
  data.awards.forEach((award, index) => {
    lines.push(`${index + 1}. ${award.title}（${award.category}）`, "流程：介绍奖项 → 入围展示 → 投票或讨论 → 确认 → 揭晓", "入围候选：");
    const candidates: SuggestedNominee[] = data.published.find((p) => p.awardId === award.id)?.candidates ?? [];
    lines.push(...(candidates.length ? candidates.map((c) => `- ${c.title}${c.workTitle ? ` · ${c.workTitle}` : ""}`) : ["- 未设置入围，请检查是否需要空缺说明。"]));
    const materials = data.materials.filter((m) => m.awardId === award.id && (m.reason || m.mediaUrl));
    lines.push("理由与素材：", ...(materials.length ? materials.flatMap((m) => [
      `- ${m.title}`, ...(m.reason ? [`  理由：${m.reason}`] : []), ...(m.mediaUrl ? [`  素材：${m.mediaUrl}`] : [])
    ]) : ["- 暂无素材。"]), "主持备注：________________", "");
  });
  return lines.join("\r\n");
}
