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
