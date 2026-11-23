import { describe, expect, it } from "vitest";
import { groupTierSharesByRun } from "../src/lib/tier-share-list";

describe("Tier List share history grouping", () => {
  const shares = [
    { runId: "run-a", title: "7月新番", token: "a-new" },
    { runId: "run-b", title: "7月新番", token: "b-new" },
    { runId: "run-a", title: "7月新番", token: "a-old" },
    { runId: "run-a", title: "旧标题", token: "a-oldest" },
    { runId: "run-b", title: "7月新番", token: "b-old" }
  ];

  it("groups by the underlying run, not by a non-unique title", () => {
    const groups = groupTierSharesByRun(shares);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.runId)).toEqual(["run-a", "run-b"]);
    expect(groups[0].latest.token).toBe("a-new");
    expect(groups[0].history.map((share) => share.token)).toEqual(["a-old", "a-oldest"]);
    expect(groups[1].latest.token).toBe("b-new");
    expect(groups[1].history.map((share) => share.token)).toEqual(["b-old"]);
  });

  it("preserves every share link and leaves the newest version first", () => {
    const groups = groupTierSharesByRun(shares);
    const tokens = groups.flatMap((group) => [group.latest, ...group.history].map((share) => share.token));

    expect(tokens).toHaveLength(shares.length);
    expect(new Set(tokens)).toEqual(new Set(shares.map((share) => share.token)));
  });

  it("handles zero and one shared snapshot", () => {
    expect(groupTierSharesByRun([])).toEqual([]);
    expect(groupTierSharesByRun([shares[0]])).toEqual([
      { runId: "run-a", latest: shares[0], history: [] }
    ]);
  });
});
