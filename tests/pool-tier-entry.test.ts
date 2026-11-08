import { describe, expect, it } from "vitest";
import { resolvePoolTierEntry } from "../src/lib/pool-tier-entry";

const publicPool = {
  poolId: "pool-1",
  visibility: "PUBLIC" as const,
  defaultRunId: null,
  isArchived: false,
  canPlay: true
};

describe("pool Tier entry", () => {
  it("opens an existing personal Tier directly without creating a default run", () => {
    expect(resolvePoolTierEntry({ ...publicPool, defaultRunId: "run-1" })).toEqual({
      kind: "personal",
      href: "/pools/pool-1/runs/run-1/tier",
      label: "查看 Tier"
    });
  });

  it("lets guests and new participants view a public community ranking without a POST", () => {
    for (const canPlay of [true, false]) {
      expect(resolvePoolTierEntry({ ...publicPool, canPlay })).toEqual({
        kind: "community",
        href: "/pools/pool-1#community-ranking",
        label: "社区榜"
      });
    }
  });

  it("only creates a private or unlisted personal Tier through an explicit create action", () => {
    for (const visibility of ["PRIVATE", "UNLISTED"] as const) {
      expect(resolvePoolTierEntry({ ...publicPool, visibility })).toEqual({
        kind: "create",
        label: "创建 Tier"
      });
    }
  });

  it("prompts unauthenticated people to log in before creating a non-public personal Tier", () => {
    expect(resolvePoolTierEntry({ ...publicPool, visibility: "UNLISTED", canPlay: false })).toEqual({
      kind: "login",
      href: "/login?next=%2Fpools%2Fpool-1",
      label: "登录建榜"
    });
  });

  it("does not offer a broken Tier link on an archived pool, even when a run ID exists", () => {
    expect(resolvePoolTierEntry({ ...publicPool, isArchived: true })).toEqual({ kind: "none" });
    expect(resolvePoolTierEntry({ ...publicPool, isArchived: true, defaultRunId: "run-1" })).toEqual({
      kind: "none"
    });
  });
});
