import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pools API default run selection", () => {
  const api = readFileSync("src/app/api/pools/route.ts", "utf8");
  const query = api.slice(api.indexOf("personalRuns: {"), api.indexOf("personalRuns: {") + 510);

  it("does not treat archived or soft-deleted runs as an accessible personal Tier", () => {
    expect(api).toContain("PersonalRunStatus");
    expect(query).toContain("status: PersonalRunStatus.ACTIVE");
    expect(query).toContain("deletedAt: null");
    expect(query).not.toContain('not: "DELETED"');
  });

  it("still selects the current user's default run, not another person's", () => {
    expect(query).toContain('userId: user?.id ?? "__anonymous__"');
    expect(query).toContain("isDefault: true");
    expect(query).toContain("take: 1");
    expect(api).toContain("defaultRunId: pool.personalRuns[0]?.id ?? null");
  });
});
