import { describe, expect, it } from "vitest";
import { formatDateTimeStable } from "@/lib/date-format";

describe("formatDateTimeStable", () => {
  it("formats ISO dates with a deterministic +08:00 display", () => {
    expect(formatDateTimeStable("2026-06-11T16:09:00.000Z")).toBe("2026-06-12 00:09");
  });

  it("returns the original string for invalid string input", () => {
    expect(formatDateTimeStable("not-a-date")).toBe("not-a-date");
  });
});
