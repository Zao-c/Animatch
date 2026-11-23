export type SeasonSchedulePhase = "DRAFT" | "UPCOMING" | "OPEN" | "CLOSED" | "ENDED";

export interface SeasonScheduleInput {
  status: string;
  startsAt: string | Date;
  endsAt: string | Date | null;
}

export interface SeasonScheduleState {
  phase: SeasonSchedulePhase;
  canVote: boolean;
}

export function getSeasonScheduleState(
  season: SeasonScheduleInput,
  now: number = Date.now()
): SeasonScheduleState {
  if (season.status === "ENDED") return { phase: "ENDED", canVote: false };
  if (season.status !== "ACTIVE") return { phase: "DRAFT", canVote: false };

  const startsAt = new Date(season.startsAt).getTime();
  const endsAt = season.endsAt ? new Date(season.endsAt).getTime() : null;

  if (Number.isFinite(startsAt) && now < startsAt) return { phase: "UPCOMING", canVote: false };
  if (endsAt !== null && Number.isFinite(endsAt) && now > endsAt) {
    return { phase: "CLOSED", canVote: false };
  }

  return { phase: "OPEN", canVote: true };
}

export interface SeasonListDisplayState {
  label: string;
  description: string;
  tone: "muted" | "warning" | "success";
  canVote: boolean;
  /** Label for the season list card call-to-action; matches the card's destination. */
  ctaLabel: string;
}

/**
 * Presentation state for a season row in the pool season list.
 *
 * The card links to the season detail page (which owns the schedule/permission
 * checks and the "开始对决" entry), so the CTA label describes that destination
 * instead of promising a direct duel.
 */
export function getSeasonListDisplayState(season: SeasonScheduleInput): SeasonListDisplayState {
  const schedule = getSeasonScheduleState(season);
  if (schedule.phase === "ENDED") {
    return { label: "已结束", description: "结果已定格，可查看个人和共享榜单。", tone: "muted", canVote: false, ctaLabel: "查看赛季结果" };
  }
  if (schedule.phase === "DRAFT" || schedule.phase === "UPCOMING") {
    return { label: "未开始", description: "赛季尚未开放投票。", tone: "warning", canVote: false, ctaLabel: "查看赛季结果" };
  }
  if (schedule.phase === "CLOSED") {
    return { label: "投票已截止", description: "投票已停止，可查看当前赛季结果。", tone: "muted", canVote: false, ctaLabel: "查看赛季结果" };
  }
  return {
    label: "开放中",
    description: season.endsAt ? `可以投票，截止到 ${new Date(season.endsAt).toLocaleDateString("zh-CN")}。` : "现在可以开始对决。",
    tone: "success",
    canVote: schedule.canVote,
    ctaLabel: schedule.canVote ? "进入赛季" : "查看赛季结果"
  };
}

export interface SeasonMatchEntry {
  href: string;
  label: string;
}

/**
 * Link target for entering a season duel. Logged-out visitors are sent to the
 * login page with the match URL preserved as `next`, so they return to the duel
 * after signing in instead of hitting a 401 on the match page.
 */
export function getSeasonMatchEntry(poolId: string, seasonId: string, isLoggedIn: boolean): SeasonMatchEntry {
  const matchPath = `/pools/${poolId}/seasons/${seasonId}/match`;
  if (isLoggedIn) {
    return { href: matchPath, label: "开始对决" };
  }
  return {
    href: `/login?next=${encodeURIComponent(matchPath)}`,
    label: "登录后开始对决"
  };
}
