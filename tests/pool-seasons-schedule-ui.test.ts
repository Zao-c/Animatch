import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("season creation schedule UI", () => {
  const source = readFileSync("src/components/PoolSeasonsSection.tsx", "utf8");

  it("offers optional opening and deadline fields and serializes them from local time", () => {
    expect(source).toContain("开放时间（可选）");
    expect(source).toContain("投票截止（可选）");
    expect(source).toContain("type=\"datetime-local\"");
    expect(source).toContain("dateTimeLocalToIso(formData.startsAt)");
    expect(source).toContain("dateTimeLocalToIso(formData.endsAt)");
  });
});
