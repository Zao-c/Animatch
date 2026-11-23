import { describe, expect, it } from "vitest";
import { dateTimeLocalToIso, toDateTimeLocalInputValue } from "../src/lib/date-time-local";
import { getSeasonListDisplayState, getSeasonMatchEntry, getSeasonScheduleState } from "../src/lib/season-schedule";

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

describe("season list display state", () => {
  // Time-independent windows so the assertions never depend on the clock.
  const openNow = { status: "ACTIVE", startsAt: "2000-01-01T00:00:00.000Z", endsAt: "2999-01-01T00:00:00.000Z" };

  it("labels an open season CTA with its destination (the season page)", () => {
    const state = getSeasonListDisplayState(openNow);
    expect(state.canVote).toBe(true);
    expect(state.ctaLabel).toBe("进入赛季");
    expect(state.label).toBe("开放中");
  });

  it.each([
    ["即将开始", { status: "ACTIVE", startsAt: "2999-01-01T00:00:00.000Z", endsAt: null }],
    ["投票已截止", { status: "ACTIVE", startsAt: "2000-01-01T00:00:00.000Z", endsAt: "2001-01-01T00:00:00.000Z" }],
    ["草稿", { status: "DRAFT", startsAt: "2000-01-01T00:00:00.000Z", endsAt: null }],
    ["已结束", { status: "ENDED", startsAt: "2000-01-01T00:00:00.000Z", endsAt: "2001-01-01T00:00:00.000Z" }]
  ])("does not promise a duel for %s seasons", (_label, season) => {
    const state = getSeasonListDisplayState(season);
    expect(state.canVote).toBe(false);
    expect(state.ctaLabel).toBe("查看赛季结果");
  });
});

describe("season match entry", () => {
  it("links straight to the duel when logged in", () => {
    expect(getSeasonMatchEntry("p1", "s1", true)).toEqual({
      href: "/pools/p1/seasons/s1/match",
      label: "开始对决"
    });
  });

  it("routes logged-out visitors through login and preserves the match URL", () => {
    const entry = getSeasonMatchEntry("p1", "s1", false);
    expect(entry.label).toBe("登录后开始对决");
    expect(entry.href).toBe(`/login?next=${encodeURIComponent("/pools/p1/seasons/s1/match")}`);
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
