import { describe, expect, it } from "vitest";
import { dateTimeLocalToIso, toDateTimeLocalInputValue } from "../src/lib/date-time-local";
import { getSeasonScheduleState } from "../src/lib/season-schedule";

describe("season schedule state", () => {
  const startsAt = "2026-07-15T00:00:00.000Z";
  const endsAt = "2026-07-20T00:00:00.000Z";

  it("keeps draft seasons unavailable even after their configured start time", () => {
    expect(getSeasonScheduleState({ status: "DRAFT", startsAt, endsAt }, Date.parse("2026-07-16T00:00:00.000Z")))
      .toEqual({ phase: "DRAFT", canVote: false });
  });

  it("distinguishes future opening, open voting, deadline, and ended seasons", () => {
    expect(getSeasonScheduleState({ status: "ACTIVE", startsAt, endsAt }, Date.parse("2026-07-14T00:00:00.000Z")))
      .toEqual({ phase: "UPCOMING", canVote: false });
    expect(getSeasonScheduleState({ status: "ACTIVE", startsAt, endsAt }, Date.parse("2026-07-16T00:00:00.000Z")))
      .toEqual({ phase: "OPEN", canVote: true });
    expect(getSeasonScheduleState({ status: "ACTIVE", startsAt, endsAt }, Date.parse("2026-07-21T00:00:00.000Z")))
      .toEqual({ phase: "CLOSED", canVote: false });
    expect(getSeasonScheduleState({ status: "ENDED", startsAt, endsAt }, Date.parse("2026-07-16T00:00:00.000Z")))
      .toEqual({ phase: "ENDED", canVote: false });
  });
});

describe("datetime-local serialization", () => {
  it("round-trips a populated local date input and leaves an empty input unset", () => {
    const input = toDateTimeLocalInputValue("2026-07-15T12:30:00.000Z");
    expect(input).toMatch(/^2026-07-15T\d{2}:30$/);
    expect(dateTimeLocalToIso(input)).toBeTruthy();
    expect(dateTimeLocalToIso("")).toBeUndefined();
  });
});
